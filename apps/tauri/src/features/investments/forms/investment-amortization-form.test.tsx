/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { InvestmentPositionView } from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentAmortizationForm } from "./investment-amortization-form"
import { correctionOperation } from "./investment-correction-test-fixtures"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  accounts: [
    { id: "wallet-1", name: "Carteira", currency: "BRL", status: "ACTIVE" },
  ],
  expenses: [
    { id: "loss-1", name: "Perdas" },
    { id: "fee-1", name: "Taxas" },
    { id: "tax-1", name: "Impostos" },
  ],
  incomes: [{ id: "gain-1", name: "Ganhos" }],
  preview: vi.fn(),
  amortization: vi.fn(),
  amend: vi.fn(),
  receipt: vi.fn(),
  toast: vi.fn(),
}))

type MockControl = {
  _formValues: Record<string, string>
  _subjects: {
    state: {
      next: (value: { name: string; values: Record<string, string> }) => void
    }
  }
}
type MockFieldProps = {
  readonly name: string
  readonly label: string
  readonly control: MockControl
  readonly disabled?: boolean
  readonly type?: string
}
type MockOptionsProps = MockFieldProps & {
  readonly options: readonly {
    readonly value: string
    readonly label: string
  }[]
}
function changeValue(control: MockControl, name: string, value: string) {
  control._formValues[name] = value
  control._subjects.state.next({ name, values: { ...control._formValues } })
}

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
  useMyFin: () => ({
    investments: {
      operations: {
        preview: { execute: state.preview },
        amortization: { execute: state.amortization },
        amend: { execute: state.amend },
      },
      requests: { get: state.receipt },
    },
  }),
}))
vi.mock("../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks")>()),
  useInvestmentAccounts: () => ({ data: state.accounts }),
}))
vi.mock("../../categories/hooks/use-expense-categories", () => ({
  useExpenseCategories: () => ({ data: state.expenses }),
}))
vi.mock("../../categories/hooks/use-income-categories", () => ({
  useIncomeCategories: () => ({ data: state.incomes }),
}))
vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toast },
}))
vi.mock("../../../components/forms/controlled-input", () => ({
  ControlledInput: ({
    name,
    label,
    control,
    disabled,
    type,
  }: MockFieldProps) => (
    <label>
      {label}
      <input
        aria-label={label}
        type={type ?? "text"}
        disabled={disabled}
        value={control._formValues[name] ?? ""}
        onChange={(event) => changeValue(control, name, event.target.value)}
      />
    </label>
  ),
}))
vi.mock("../../../components/forms/controlled-select", () => ({
  ControlledSelect: ({
    name,
    label,
    options,
    control,
    disabled,
  }: MockOptionsProps) => (
    <label>
      {label}
      <select
        aria-label={label}
        disabled={disabled}
        value={control._formValues[name] ?? ""}
        onChange={(event) => changeValue(control, name, event.target.value)}
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}))

const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB",
  assetClass: "FIXED_INCOME",
  quantity: "10",
  bookCostMinor: "100000",
  currency: "BRL",
  status: "OPEN",
  version: 4,
  allocationRevision: 2,
  valuation: { basis: "BOOK_COST", currentValueMinor: "100000" },
}

function success() {
  state.preview.mockResolvedValue({
    ok: true,
    value: {
      positionId: "position-1",
      positionVersion: 4,
      allocationRevision: 3,
      bookCostDeltaMinor: "-20000",
      netCashFlowMinor: "22000",
      postings: [
        { accountId: "wallet-1", amountMinor: "2000" },
        { accountId: "gain-1", amountMinor: "-2000" },
      ],
      categories: { gainCategoryId: "gain-1" },
      projectedCashMinor: "72000",
      warnings: [],
    },
  })
  state.amortization.mockResolvedValue({
    ok: true,
    value: {
      requestId: "request-1",
      positionId: "position-1",
      positionVersion: 5,
      allocationRevision: 3,
      operationId: "operation-1",
      journalEntryIds: ["entry-1"],
      warnings: [],
    },
  })
  state.receipt.mockResolvedValue(null)
}
function renderForm(target: InvestmentPositionView = position) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <InvestmentAmortizationForm position={target} />
    </QueryClientProvider>
  )
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
function basic() {
  fill("Custo reduzido", "200,00")
  fill("Valor bruto recebido", "220,00")
  fill("Categoria de ganho", "gain-1")
  fill("Data da operação", "2026-09-01")
}
function save() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar amortização" }))
}

function renderCorrection(operation: ReturnType<typeof correctionOperation>) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <InvestmentAmortizationForm
        position={position}
        amendment={{ operation, reason: "Ajuste justificado" }}
      />
    </QueryClientProvider>
  )
}

describe("InvestmentAmortizationForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
  })

  it("requires an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })

  it("asks cost, gross and expenses but not units or an external destination", () => {
    success()
    renderForm()
    expect(screen.getByLabelText("Custo reduzido")).toBeTruthy()
    expect(screen.getByLabelText("Valor bruto recebido")).toBeTruthy()
    expect(screen.getByLabelText("Taxas")).toBeTruthy()
    expect(screen.getByLabelText("Impostos")).toBeTruthy()
    expect(screen.queryByLabelText("Quantidade")).toBeNull()
    expect(screen.queryByLabelText("Conta de destino")).toBeNull()
  })

  it("rejects a closed position", async () => {
    success()
    renderForm({ ...position, status: "CLOSED" })
    basic()
    save()
    await waitFor(() => expect(screen.getByText(/posição aberta/)).toBeTruthy())
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("requires a positive cost reduction", async () => {
    success()
    renderForm()
    basic()
    fill("Custo reduzido", "0")
    save()
    await waitFor(() =>
      expect(screen.getByText(/custo reduzido maior que zero/)).toBeTruthy()
    )
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("rejects a reduction above current cost", async () => {
    success()
    renderForm()
    basic()
    fill("Custo reduzido", "1000,01")
    save()
    await waitFor(() =>
      expect(screen.getByText(/excede o custo da posição/)).toBeTruthy()
    )
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("accepts explicit zero gross proceeds with a loss category", async () => {
    success()
    renderForm()
    basic()
    fill("Valor bruto recebido", "0")
    fill("Categoria de perda", "loss-1")
    save()
    await waitFor(() =>
      expect(state.amortization).toHaveBeenCalledWith(
        expect.objectContaining({
          grossProceedsMinor: "0",
          bookCostReductionMinor: "20000",
          lossCategoryId: "loss-1",
        })
      )
    )
  })

  it("requires a gain category when gross exceeds reduced cost", async () => {
    success()
    renderForm()
    basic()
    fill("Categoria de ganho", "")
    save()
    await waitFor(() =>
      expect(screen.getByText(/categoria de ganho/)).toBeTruthy()
    )
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("requires a loss category when gross is below reduced cost", async () => {
    success()
    renderForm()
    basic()
    fill("Valor bruto recebido", "180,00")
    save()
    await waitFor(() =>
      expect(screen.getByText(/categoria de perda/)).toBeTruthy()
    )
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("requires categories for nonzero fees and taxes", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "2,00")
    fill("Impostos", "10,00")
    save()
    await waitFor(() =>
      expect(screen.getByText(/categoria de taxas/)).toBeTruthy()
    )
    fill("Categoria de taxas", "fee-1")
    save()
    await waitFor(() =>
      expect(screen.getByText(/categoria de impostos/)).toBeTruthy()
    )
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("rejects expenses greater than gross proceeds", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "221,00")
    save()
    await waitFor(() =>
      expect(screen.getByText(/líquido não pode ser negativo/)).toBeTruthy()
    )
    expect(state.amortization).not.toHaveBeenCalled()
  })

  it("sends one amortization with CAS, internal cash and no quantity change", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "2,00")
    fill("Impostos", "10,00")
    fill("Categoria de taxas", "fee-1")
    fill("Categoria de impostos", "tax-1")
    save()
    await waitFor(() =>
      expect(state.amortization).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          positionId: "position-1",
          expectedPositionVersion: 4,
          type: "AMORTIZATION",
          currency: "BRL",
          occurredOn: "2026-09-01",
          bookCostReductionMinor: "20000",
          grossProceedsMinor: "22000",
          feesMinor: "200",
          taxesMinor: "1000",
          cashMode: "INTERNAL_CASH",
          gainCategoryId: "gain-1",
          feeCategoryId: "fee-1",
          taxCategoryId: "tax-1",
        })
      )
    )
    expect(state.amortization).toHaveBeenCalledTimes(1)
    expect(state.amortization.mock.calls[0][0]).not.toHaveProperty(
      "quantityDelta"
    )
    expect(state.amortization.mock.calls[0][0]).not.toHaveProperty(
      "destination"
    )
  })

  it("previews reduced cost, net flow, gross result and account categories", async () => {
    success()
    renderForm()
    basic()
    await waitFor(() =>
      expect(screen.getByText(/Custo: -R\$\s*200,00/)).toBeTruthy()
    )
    expect(screen.getByText(/Custo após: R\$\s*800,00/)).toBeTruthy()
    expect(screen.getByText(/Resultado bruto: R\$\s*20,00/)).toBeTruthy()
    expect(screen.getByText(/Fluxo líquido: R\$\s*220,00/)).toBeTruthy()
    expect(screen.getByText(/Carteira: R\$\s*20,00/)).toBeTruthy()
    expect(screen.getByText(/Ganhos: -R\$\s*20,00/)).toBeTruthy()
    expect(screen.getByText(/Categoria de ganho: Ganhos/)).toBeTruthy()
  })

  it("shows gross gain 100, tax 20, ledger gain 80 and cash receipt 280", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 3,
        bookCostDeltaMinor: "-20000",
        netCashFlowMinor: "28000",
        postings: [
          { accountId: "wallet-1", amountMinor: "8000" },
          { accountId: "gain-1", amountMinor: "-10000" },
          { accountId: "tax-1", amountMinor: "2000" },
        ],
        categories: { gainCategoryId: "gain-1", taxCategoryId: "tax-1" },
        projectedCashMinor: "78000",
        warnings: [],
      },
    })
    renderForm()
    basic()
    fill("Valor bruto recebido", "300,00")
    fill("Impostos", "20,00")
    fill("Categoria de impostos", "tax-1")
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            type: "AMORTIZATION",
            bookCostReductionMinor: "20000",
            grossProceedsMinor: "30000",
            taxesMinor: "2000",
            gainCategoryId: "gain-1",
            taxCategoryId: "tax-1",
          }),
        })
      )
    )
    await waitFor(() =>
      expect(screen.getByText(/Resultado bruto: R\$\s*100,00/)).toBeTruthy()
    )
    expect(screen.getByText(/Fluxo líquido: R\$\s*280,00/)).toBeTruthy()
    expect(screen.getByText(/Carteira: R\$\s*80,00/)).toBeTruthy()
    expect(screen.getByText(/Ganhos: -R\$\s*100,00/)).toBeTruthy()
    expect(screen.getByText(/Impostos: R\$\s*20,00/)).toBeTruthy()
  })

  it("warns about negative cash without disabling Save", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 3,
        bookCostDeltaMinor: "-20000",
        netCashFlowMinor: "22000",
        postings: [],
        categories: {},
        projectedCashMinor: "-1000",
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "wallet-1",
            cashMinor: "-1000",
            currency: "BRL",
            asOf: "2026-09-01",
          },
        ],
      },
    })
    renderForm()
    basic()
    await waitFor(() =>
      expect(screen.getByText(/Possível caixa negativo/)).toBeTruthy()
    )
    expect(
      screen.getByRole("button", { name: "Registrar amortização" })
    ).not.toHaveProperty("disabled", true)
  })

  it("locks repeated submission while pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.amortization.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    basic()
    const button = screen.getByRole("button", { name: "Registrar amortização" })
    save()
    await waitFor(() => expect(button).toHaveProperty("disabled", true))
    fireEvent.click(button)
    expect(state.amortization).toHaveBeenCalledTimes(1)
    complete?.({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        operationId: "operation-1",
        journalEntryIds: ["entry-1"],
        warnings: [],
      },
    })
    await waitFor(() => expect(button).toHaveProperty("disabled", false))
  })

  it("preserves fields and requestId for retry after a failed submission", async () => {
    success()
    state.amortization.mockResolvedValueOnce({
      ok: false,
      error: { code: "TEMPORARY" },
    })
    renderForm()
    basic()
    save()
    await waitFor(() =>
      expect(screen.getByText(/tente novamente/i)).toBeTruthy()
    )
    expect(screen.getByLabelText("Custo reduzido")).toHaveProperty(
      "value",
      "200,00"
    )
    expect(screen.getByLabelText("Valor bruto recebido")).toHaveProperty(
      "value",
      "220,00"
    )
    save()
    await waitFor(() => expect(state.amortization).toHaveBeenCalledTimes(2))
    expect(state.amortization.mock.calls[1][0].requestId).toBe(
      state.amortization.mock.calls[0][0].requestId
    )
  })

  it("reports a CAS conflict with an instruction to refresh", async () => {
    success()
    state.amortization.mockResolvedValue({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    renderForm()
    basic()
    save()
    await waitFor(() =>
      expect(screen.getByText(/Atualize a posição/)).toBeTruthy()
    )
  })
  it("amends the original AMORTIZATION through its specialized fields", async () => {
    success()
    state.amend.mockResolvedValue({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        positionVersion: 5,
        operationId: "operation-original",
        replacementOperationId: "replacement-1",
        journalEntryIds: [],
        warnings: [],
      },
    })
    renderCorrection(
      correctionOperation("AMORTIZATION", {
        bookCostDeltaMinor: "-20000",
        grossAmountMinor: "22000",
        gainCategoryId: "gain-1",
      })
    )
    expect(screen.getByLabelText("Custo reduzido")).toHaveProperty(
      "value",
      "200,00"
    )
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() =>
      expect(state.amend).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: "operation-original",
          expectedOperationVersion: 0,
          expectedPositionVersion: 4,
          reason: "Ajuste justificado",
          replacement: expect.objectContaining({
            bookCostReductionMinor: "20000",
            grossProceedsMinor: "22000",
            type: "AMORTIZATION",
          }),
        })
      )
    )
    expect(state.amortization).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          amendment: {
            operationId: "operation-original",
            expectedOperationVersion: 0,
          },
        })
      )
    )
  })
})
