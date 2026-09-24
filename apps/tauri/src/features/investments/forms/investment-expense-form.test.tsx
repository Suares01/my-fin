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
import { InvestmentExpenseForm } from "./investment-expense-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  accounts: [
    { id: "wallet-1", name: "Carteira", currency: "BRL", status: "ACTIVE" },
  ],
  expenses: [
    { id: "fee-1", name: "Taxas" },
    { id: "tax-1", name: "Impostos" },
  ],
  preview: vi.fn(),
  expense: vi.fn(),
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
        expense: { execute: state.expense },
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
vi.mock("../../../components/forms/controlled-toggle-group", () => ({
  ControlledToggleGroup: ({
    name,
    label,
    options,
    control,
    disabled,
  }: MockOptionsProps) => (
    <fieldset disabled={disabled}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={control._formValues[name] === option.value}
            onChange={(event) => changeValue(control, name, event.target.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
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
      allocationRevision: 2,
      bookCostDeltaMinor: "0",
      netCashFlowMinor: "-1000",
      postings: [
        { accountId: "wallet-1", amountMinor: "-1000" },
        { accountId: "fee-1", amountMinor: "1000" },
      ],
      categories: { feeCategoryId: "fee-1" },
      projectedCashMinor: "-1000",
      warnings: [],
    },
  })
  state.expense.mockResolvedValue({
    ok: true,
    value: {
      requestId: "request-1",
      positionId: "position-1",
      positionVersion: 5,
      allocationRevision: 2,
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
      <InvestmentExpenseForm position={target} />
    </QueryClientProvider>
  )
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
function basic() {
  fill("Valor pago", "10,00")
  fill("Categoria de despesa", "fee-1")
  fill("Data da operação", "2026-09-01")
}
function save() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar despesa" }))
}

describe("InvestmentExpenseForm", () => {
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

  it("asks type, amount, expense category and date, without principal, units or external route", () => {
    success()
    renderForm()
    expect(screen.getByRole("group", { name: "Tipo de despesa" })).toBeTruthy()
    expect(screen.getByLabelText("Valor pago")).toBeTruthy()
    expect(screen.getByLabelText("Categoria de despesa")).toBeTruthy()
    expect(screen.getByLabelText("Data da operação")).toBeTruthy()
    expect(screen.queryByLabelText("Custo reduzido")).toBeNull()
    expect(screen.queryByLabelText("Quantidade")).toBeNull()
    expect(screen.queryByLabelText("Conta de destino")).toBeNull()
    expect(screen.getByText(/vinculada à posição CDB/)).toBeTruthy()
  })

  it("records a fee with internal cash, CAS and explicit expense category", async () => {
    success()
    renderForm()
    basic()
    save()
    await waitFor(() =>
      expect(state.expense).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          positionId: "position-1",
          expectedPositionVersion: 4,
          type: "FEE",
          amountMinor: "1000",
          expenseCategoryId: "fee-1",
          cashMode: "INTERNAL_CASH",
          currency: "BRL",
          occurredOn: "2026-09-01",
        })
      )
    )
    expect(state.expense).toHaveBeenCalledTimes(1)
    expect(state.expense.mock.calls[0][0]).not.toHaveProperty("quantityDelta")
    expect(state.expense.mock.calls[0][0]).not.toHaveProperty(
      "bookCostReductionMinor"
    )
  })

  it("records a tax as TAX rather than a FEE", async () => {
    success()
    renderForm()
    fireEvent.click(screen.getByLabelText("Imposto"))
    fill("Valor pago", "20,00")
    fill("Categoria de despesa", "tax-1")
    fill("Data da operação", "2026-09-01")
    save()
    await waitFor(() =>
      expect(state.expense).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TAX",
          amountMinor: "2000",
          expenseCategoryId: "tax-1",
          cashMode: "INTERNAL_CASH",
        })
      )
    )
    expect(state.expense).toHaveBeenCalledTimes(1)
  })

  it("allows a fee on a closed position without reopening or editing allocation", async () => {
    success()
    renderForm({
      ...position,
      status: "CLOSED",
      quantity: "0",
      bookCostMinor: "0",
    })
    basic()
    save()
    await waitFor(() =>
      expect(state.expense).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: "position-1",
          expectedPositionVersion: 4,
          type: "FEE",
          amountMinor: "1000",
        })
      )
    )
    expect(state.expense.mock.calls[0][0]).not.toHaveProperty("quantityDelta")
    expect(state.expense.mock.calls[0][0]).not.toHaveProperty(
      "bookCostReductionMinor"
    )
  })

  it("rejects zero amount", async () => {
    success()
    renderForm()
    basic()
    fill("Valor pago", "0")
    save()
    await waitFor(() =>
      expect(screen.getByText(/valor pago maior que zero/)).toBeTruthy()
    )
    expect(state.expense).not.toHaveBeenCalled()
  })

  it("requires an active expense category", async () => {
    success()
    renderForm()
    fill("Valor pago", "10,00")
    fill("Data da operação", "2026-09-01")
    save()
    await waitFor(() =>
      expect(screen.getByText(/categoria de despesa/)).toBeTruthy()
    )
    expect(state.expense).not.toHaveBeenCalled()
  })

  it("previews zero cost, negative cash flow and matching account/category effects", async () => {
    success()
    renderForm()
    basic()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            type: "FEE",
            amountMinor: "1000",
            expenseCategoryId: "fee-1",
            cashMode: "INTERNAL_CASH",
          }),
        })
      )
    )
    await waitFor(() =>
      expect(screen.getByText(/Custo: R\$\s*0,00/)).toBeTruthy()
    )
    expect(screen.getByText(/Fluxo líquido: -R\$\s*10,00/)).toBeTruthy()
    expect(screen.getByText(/Carteira: -R\$\s*10,00/)).toBeTruthy()
    expect(screen.getByText(/Taxas: R\$\s*10,00/)).toBeTruthy()
    expect(screen.getByText(/Categoria de despesa: Taxas/)).toBeTruthy()
  })

  it("shows negative-cash warning while Save remains enabled", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "0",
        netCashFlowMinor: "-1000",
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
      screen.getByRole("button", { name: "Registrar despesa" })
    ).not.toHaveProperty("disabled", true)
  })

  it("passes confirmed negative-cash warning to the success callback", async () => {
    success()
    const warning = {
      code: "INVESTMENT_CASH_NEGATIVE",
      investmentAccountId: "wallet-1",
      cashMinor: "-1010",
      currency: "BRL",
      asOf: "2026-09-01",
    }
    state.expense.mockResolvedValue({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        positionVersion: 5,
        allocationRevision: 2,
        operationId: "operation-1",
        journalEntryIds: ["entry-1"],
        warnings: [warning],
      },
    })
    const onSuccess = vi.fn()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <InvestmentExpenseForm position={position} onSuccess={onSuccess} />
      </QueryClientProvider>
    )
    basic()
    save()
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ warnings: [warning] })
      )
    )
  })

  it("prevents duplicate submission while pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.expense.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    basic()
    const button = screen.getByRole("button", { name: "Registrar despesa" })
    save()
    await waitFor(() => expect(button).toHaveProperty("disabled", true))
    fireEvent.click(button)
    expect(state.expense).toHaveBeenCalledTimes(1)
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

  it("preserves amount, type and requestId for a retry after failure", async () => {
    success()
    state.expense.mockResolvedValueOnce({
      ok: false,
      error: { code: "TEMPORARY" },
    })
    renderForm()
    fireEvent.click(screen.getByLabelText("Imposto"))
    fill("Valor pago", "20,00")
    fill("Categoria de despesa", "tax-1")
    fill("Data da operação", "2026-09-01")
    save()
    await waitFor(() =>
      expect(screen.getByText(/tente novamente/i)).toBeTruthy()
    )
    expect(screen.getByLabelText("Valor pago")).toHaveProperty("value", "20,00")
    expect(screen.getByLabelText("Imposto")).toHaveProperty("checked", true)
    save()
    await waitFor(() => expect(state.expense).toHaveBeenCalledTimes(2))
    expect(state.expense.mock.calls[1][0].requestId).toBe(
      state.expense.mock.calls[0][0].requestId
    )
  })

  it("reports a CAS conflict with an instruction to refresh", async () => {
    success()
    state.expense.mockResolvedValue({
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
})
