/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type {
  InvestmentOperationHistoryItem,
  InvestmentPositionView,
} from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentCorrectionForm } from "./investment-correction-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  reverse: vi.fn(),
  receipt: vi.fn(),
  toast: vi.fn(),
}))
vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
  useMyFin: () => ({
    investments: {
      operations: { reverse: { execute: state.reverse } },
      requests: { get: state.receipt },
    },
  }),
}))
vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toast },
}))
type ChildProps = {
  position: InvestmentPositionView
  amendment?: { operation: InvestmentOperationHistoryItem; reason: string }
}
function child(type: string, { position, amendment }: ChildProps) {
  return (
    <output
      data-testid="correction-child"
      data-type={type}
      data-cost={position.bookCostMinor}
      data-status={position.status}
      data-reason={amendment?.reason}
      data-operation={amendment?.operation.id}
    >
      {type}
    </output>
  )
}
vi.mock("./investment-purchase-form", () => ({
  InvestmentPurchaseForm: (props: ChildProps) => child("PURCHASE", props),
}))
vi.mock("./investment-sale-form", () => ({
  InvestmentSaleForm: (props: ChildProps) => child("SALE", props),
}))
vi.mock("./investment-income-form", () => ({
  InvestmentIncomeForm: (props: ChildProps) => child("INCOME", props),
}))
vi.mock("./investment-amortization-form", () => ({
  InvestmentAmortizationForm: (props: ChildProps) =>
    child("AMORTIZATION", props),
}))
vi.mock("./investment-expense-form", () => ({
  InvestmentExpenseForm: (props: ChildProps) => child("EXPENSE", props),
}))

const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB",
  assetClass: "FIXED_INCOME",
  quantity: "0",
  bookCostMinor: "0",
  currency: "BRL",
  status: "CLOSED",
  version: 7,
  allocationRevision: 3,
  valuation: { basis: "BOOK_COST", currentValueMinor: "0" },
}
const operation: InvestmentOperationHistoryItem = {
  id: "operation-1",
  type: "SALE",
  role: "BUSINESS",
  version: 2,
  occurredOn: "2026-09-01",
  recordedAt: "2026-09-01T12:00:00.000Z",
  sequence: "9",
  description: "Venda",
  currency: "BRL",
  grossAmountMinor: "120000",
  netCashFlowMinor: "120000",
  bookCostDeltaMinor: "-100000",
  feesMinor: "0",
  taxesMinor: "0",
  cashMode: "INTERNAL_CASH",
  beforeKind: "EXISTING",
  beforeQuantity: "10",
  beforeBookCostMinor: "100000",
  beforeStatus: "OPEN",
  beforeOpenedOn: "2026-01-01",
}
const warning = {
  code: "INVESTMENT_CASH_NEGATIVE",
  investmentAccountId: "wallet-1",
  cashMinor: "-100",
  currency: "BRL",
  asOf: "2026-09-01",
}
const result = {
  requestId: "request-1",
  positionId: position.id,
  positionVersion: 8,
  operationId: operation.id,
  reversalOperationId: "reversal-1",
  journalEntryIds: [],
  warnings: [warning],
}
function setup() {
  state.reverse.mockResolvedValue({ ok: true, value: result })
  state.receipt.mockResolvedValue(null)
}
function renderForm(
  target = operation,
  lastEffectiveOperationId = operation.id,
  onSuccess = vi.fn()
) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <InvestmentCorrectionForm
        position={position}
        operation={target}
        lastEffectiveOperationId={lastEffectiveOperationId}
        onSuccess={onSuccess}
      />
    </QueryClientProvider>
  )
  return onSuccess
}
function reason(value = "Corrigir lançamento") {
  fireEvent.change(screen.getByLabelText("Motivo da correção"), {
    target: { value },
  })
}
function chooseAmend() {
  fireEvent.click(screen.getByText("Substituir"))
}
function cancel() {
  fireEvent.click(screen.getByRole("button", { name: "Cancelar operação" }))
}

describe("InvestmentCorrectionForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
  })
  it("requires the active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })
  it("rejects an operation that is not the last effective one", () => {
    renderForm(operation, "later")
    expect(screen.getByText(/última operação efetiva/)).toBeTruthy()
    expect(screen.queryByLabelText("Motivo da correção")).toBeNull()
  })
  it("rejects an operation already reversed", () => {
    renderForm({ ...operation, reversedBy: "reversal-1" })
    expect(screen.getByText(/Operação não corrigível/)).toBeTruthy()
  })
  it("rejects an operation already replaced", () => {
    renderForm({ ...operation, replacedBy: "replacement-1" })
    expect(screen.getByText(/Operação não corrigível/)).toBeTruthy()
  })
  it("rejects a reversal even when it is newest", () => {
    renderForm({ ...operation, role: "REVERSAL", reversalOf: "older" })
    expect(screen.getByText(/Operação não corrigível/)).toBeTruthy()
  })
  it("requests a reason and shows that reversal dates are derived", () => {
    renderForm()
    expect(screen.getByLabelText("Motivo da correção")).toBeTruthy()
    expect(screen.getByText(/data da reversão é derivada/)).toBeTruthy()
    expect(screen.queryByLabelText("Data da reversão")).toBeNull()
  })
  it("blocks cancellation without a reason", async () => {
    renderForm()
    cancel()
    await waitFor(() =>
      expect(screen.getByText(/motivo da correção\./)).toBeTruthy()
    )
    expect(state.reverse).not.toHaveBeenCalled()
  })
  it("sends book, operation and both observed versions with the reason", async () => {
    setup()
    renderForm()
    reason()
    cancel()
    await waitFor(() =>
      expect(state.reverse).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          operationId: "operation-1",
          expectedOperationVersion: 2,
          expectedPositionVersion: 7,
          reason: "Corrigir lançamento",
        })
      )
    )
  })
  it("does not send caller-controlled reversal dates", async () => {
    setup()
    renderForm()
    reason()
    cancel()
    await waitFor(() => expect(state.reverse).toHaveBeenCalledTimes(1))
    expect(state.reverse.mock.calls[0][0]).not.toHaveProperty("occurredOn")
    expect(state.reverse.mock.calls[0][0]).not.toHaveProperty("recordedAt")
  })
  it("returns confirmed reversal and warnings to the caller", async () => {
    setup()
    const onSuccess = renderForm()
    reason()
    cancel()
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(result))
  })
  it("locks repeat cancellation while pending", async () => {
    setup()
    let finish: ((value: unknown) => void) | undefined
    state.reverse.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    renderForm()
    reason()
    cancel()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Cancelar operação/ })
      ).toHaveProperty("disabled", true)
    )
    cancel()
    expect(state.reverse).toHaveBeenCalledTimes(1)
    finish?.({ ok: true, value: result })
  })
  it("preserves reason and requestId after failed cancellation", async () => {
    setup()
    state.reverse.mockResolvedValueOnce({
      ok: false,
      error: { code: "TEMPORARY" },
    })
    renderForm()
    reason()
    cancel()
    await waitFor(() =>
      expect(screen.getByText(/dados foram preservados/)).toBeTruthy()
    )
    expect(screen.getByLabelText("Motivo da correção")).toHaveProperty(
      "value",
      "Corrigir lançamento"
    )
    cancel()
    await waitFor(() => expect(state.reverse).toHaveBeenCalledTimes(2))
    expect(state.reverse.mock.calls[1][0].requestId).toBe(
      state.reverse.mock.calls[0][0].requestId
    )
  })
  it("asks to reload after concurrency conflict", async () => {
    setup()
    state.reverse.mockResolvedValue({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    renderForm()
    reason()
    cancel()
    await waitFor(() =>
      expect(screen.getByText(/Recarregue o histórico/)).toBeTruthy()
    )
  })
  it("asks to reactivate archived dependencies", async () => {
    setup()
    state.reverse.mockResolvedValue({
      ok: false,
      error: { code: "INVESTMENT_ENTITY_NOT_ACTIVE" },
    })
    renderForm()
    reason()
    cancel()
    await waitFor(() =>
      expect(
        screen.getByText(/Reative a carteira e o instrumento/)
      ).toBeTruthy()
    )
  })
  it("offers cancellation only for initial allocation", () => {
    renderForm({
      ...operation,
      type: "OPENING_ALLOCATION",
      beforeKind: "UNOPENED",
      beforeBookCostMinor: undefined,
      beforeStatus: undefined,
    })
    expect(screen.queryByText("Substituir")).toBeNull()
    expect(
      screen.getByRole("button", { name: "Cancelar operação" })
    ).toBeTruthy()
  })
  it.each([
    ["APPLICATION", "PURCHASE"],
    ["PURCHASE", "PURCHASE"],
    ["SALE", "SALE"],
    ["REDEMPTION", "SALE"],
    ["INCOME", "INCOME"],
    ["AMORTIZATION", "AMORTIZATION"],
    ["FEE", "EXPENSE"],
    ["TAX", "EXPENSE"],
  ])("routes %s amendment to its specialized form", (type, target) => {
    renderForm({ ...operation, type })
    reason("Motivo específico")
    chooseAmend()
    expect(
      screen.getByTestId("correction-child").getAttribute("data-type")
    ).toBe(target)
    expect(
      screen.getByTestId("correction-child").getAttribute("data-reason")
    ).toBe("Motivo específico")
  })
  it("prepares replacement against the original position state after a full sale", () => {
    renderForm()
    reason()
    chooseAmend()
    expect(
      screen.getByTestId("correction-child").getAttribute("data-cost")
    ).toBe("100000")
    expect(
      screen.getByTestId("correction-child").getAttribute("data-status")
    ).toBe("OPEN")
  })
})
