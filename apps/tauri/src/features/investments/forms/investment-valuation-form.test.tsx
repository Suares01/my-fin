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
import { InvestmentValuationForm } from "./investment-valuation-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  record: vi.fn(),
  receipt: vi.fn(),
  toast: vi.fn(),
}))
type Control = {
  _formValues: Record<string, string>
  _subjects: {
    state: {
      next: (value: { name: string; values: Record<string, string> }) => void
    }
  }
}
vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
  useMyFin: () => ({
    investments: {
      valuations: { record: { execute: state.record } },
      requests: { get: state.receipt },
    },
  }),
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
  }: {
    name: string
    label: string
    control: Control
    disabled?: boolean
    type?: string
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        type={type ?? "text"}
        disabled={disabled}
        value={control._formValues[name] ?? ""}
        onChange={(event) => {
          control._formValues[name] = event.target.value
          control._subjects.state.next({
            name,
            values: { ...control._formValues },
          })
        }}
      />
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
  state.record.mockResolvedValue({
    ok: true,
    value: {
      requestId: "request-1",
      positionId: "position-1",
      positionVersion: 4,
      allocationRevision: 2,
      valuationId: "valuation-1",
      journalEntryIds: [],
      warnings: [],
    },
  })
  state.receipt.mockResolvedValue(null)
}
function renderForm(target = position, onSuccess = vi.fn()) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <InvestmentValuationForm position={target} onSuccess={onSuccess} />
    </QueryClientProvider>
  )
  return onSuccess
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
function basic() {
  fill("Valor bruto", "1.200,00")
  fill("Valor líquido", "1.180,00")
  fill("Valor resgatável", "900,00")
  fill("Quantidade", "10")
  fill("Preço unitário", "120")
  fill("Instante da avaliação", "2026-09-01T10:00")
}
function save() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar avaliação" }))
}

describe("InvestmentValuationForm", () => {
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
  it("asks gross, optional net and withdrawable values, quantity, price and instant", () => {
    renderForm()
    expect(screen.getByLabelText("Valor bruto")).toBeTruthy()
    expect(screen.getByLabelText("Valor líquido")).toBeTruthy()
    expect(screen.getByLabelText("Valor resgatável")).toBeTruthy()
    expect(screen.getByLabelText("Quantidade")).toHaveProperty("value", "10")
    expect(screen.getByLabelText("Preço unitário")).toBeTruthy()
    expect(screen.getByLabelText("Instante da avaliação")).toBeTruthy()
  })
  it("records the observed allocation revision, value, coherent quantity and ISO instant", async () => {
    success()
    renderForm()
    basic()
    save()
    await waitFor(() =>
      expect(state.record).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          positionId: "position-1",
          expectedAllocationRevision: 2,
          grossValueMinor: "120000",
          netValueMinor: "118000",
          withdrawableValueMinor: "90000",
          quantity: "10",
          unitPrice: "120",
          valuedAt: new Date("2026-09-01T10:00").toISOString(),
        })
      )
    )
  })
  it("keeps optional net and withdrawable values unknown", async () => {
    success()
    renderForm()
    basic()
    fill("Valor líquido", "")
    fill("Valor resgatável", "")
    save()
    await waitFor(() => expect(state.record).toHaveBeenCalledTimes(1))
    expect(state.record.mock.calls[0][0]).not.toHaveProperty("netValueMinor")
    expect(state.record.mock.calls[0][0]).not.toHaveProperty(
      "withdrawableValueMinor"
    )
  })
  it("does not ask units or unit price for an amount position", () => {
    renderForm({ ...position, quantity: undefined })
    expect(screen.queryByLabelText("Quantidade")).toBeNull()
    expect(screen.queryByLabelText("Preço unitário")).toBeNull()
  })
  it("rejects an absent gross value", async () => {
    renderForm()
    basic()
    fill("Valor bruto", "")
    save()
    await waitFor(() =>
      expect(screen.getByText(/valor bruto válido/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("rejects a negative gross value", async () => {
    renderForm()
    basic()
    fill("Valor bruto", "-1")
    save()
    await waitFor(() =>
      expect(screen.getByText(/valor bruto válido/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("rejects negative optional net values", async () => {
    renderForm()
    basic()
    fill("Valor líquido", "-1")
    save()
    await waitFor(() =>
      expect(screen.getByText(/valor líquido válido/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("rejects negative optional withdrawable values", async () => {
    renderForm()
    basic()
    fill("Valor resgatável", "-1")
    save()
    await waitFor(() =>
      expect(screen.getByText(/valor resgatável válido/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("requires both quantity and unit price for a units position", async () => {
    renderForm()
    basic()
    fill("Preço unitário", "")
    save()
    await waitFor(() =>
      expect(screen.getByText(/quantidade e preço unitário/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("rejects a quantity that differs from the allocation revision", async () => {
    renderForm()
    basic()
    fill("Quantidade", "9")
    save()
    await waitFor(() =>
      expect(screen.getByText(/corresponder à posição atual/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("rejects an invalid observation instant", async () => {
    renderForm()
    basic()
    fill("Instante da avaliação", "")
    save()
    await waitFor(() =>
      expect(screen.getByText(/instante da avaliação/)).toBeTruthy()
    )
    expect(state.record).not.toHaveBeenCalled()
  })
  it("locks repeated submission while pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.record.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    basic()
    const button = screen.getByRole("button", { name: "Registrar avaliação" })
    save()
    await waitFor(() => expect(button).toHaveProperty("disabled", true))
    fireEvent.click(button)
    expect(state.record).toHaveBeenCalledTimes(1)
    complete?.({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        valuationId: "valuation-1",
        journalEntryIds: [],
        warnings: [],
      },
    })
  })
  it("preserves the draft and requestId after an ordinary failure", async () => {
    success()
    state.record.mockResolvedValueOnce({
      ok: false,
      error: { code: "TEMPORARY" },
    })
    renderForm()
    basic()
    save()
    await waitFor(() =>
      expect(screen.getByText(/dados foram preservados/)).toBeTruthy()
    )
    expect(screen.getByLabelText("Valor bruto")).toHaveProperty(
      "value",
      "1.200,00"
    )
    save()
    await waitFor(() => expect(state.record).toHaveBeenCalledTimes(2))
    expect(state.record.mock.calls[1][0].requestId).toBe(
      state.record.mock.calls[0][0].requestId
    )
  })
  it("asks to reload after a stale allocation revision", async () => {
    success()
    state.record.mockResolvedValue({
      ok: false,
      error: { code: "INVESTMENT_ALLOCATION_CHANGED" },
    })
    renderForm()
    basic()
    save()
    await waitFor(() =>
      expect(screen.getByText(/Recarregue a posição/)).toBeTruthy()
    )
  })
  it("does not convert a valuation into cost or reported profit", async () => {
    success()
    renderForm()
    basic()
    save()
    await waitFor(() => expect(state.record).toHaveBeenCalledTimes(1))
    expect(state.record.mock.calls[0][0]).not.toHaveProperty("bookCostMinor")
    expect(state.record.mock.calls[0][0]).not.toHaveProperty("profitMinor")
  })
})
