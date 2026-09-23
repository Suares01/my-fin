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
import { InvestmentIncomeForm } from "./investment-income-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  accounts: [
    { id: "wallet-1", name: "Carteira", currency: "BRL", status: "ACTIVE" },
  ] as Array<Record<string, unknown>>,
  expenses: [
    { id: "fee-1", name: "Taxas" },
    { id: "tax-1", name: "Impostos" },
  ],
  incomes: [{ id: "income-1", name: "Rendimentos" }],
  preview: vi.fn(),
  income: vi.fn(),
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
type MockOption = { readonly value: string; readonly label: string }
type MockFieldProps = {
  readonly name: string
  readonly label: string
  readonly control: MockControl
  readonly disabled?: boolean
  readonly type?: string
}
type MockOptionsProps = MockFieldProps & {
  readonly options: readonly MockOption[]
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
        income: { execute: state.income },
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

const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB",
  assetClass: "FIXED_INCOME",
  quantity: "10",
  bookCostMinor: "500000",
  currency: "BRL",
  status: "OPEN",
  version: 4,
  allocationRevision: 2,
  valuation: { basis: "BOOK_COST", currentValueMinor: "500000" },
}

function success() {
  state.preview.mockResolvedValue({
    ok: true,
    value: {
      positionId: "position-1",
      positionVersion: 4,
      allocationRevision: 2,
      bookCostDeltaMinor: "0",
      netCashFlowMinor: "10000",
      postings: [],
      categories: {},
      projectedCashMinor: "50000",
      warnings: [],
    },
  })
  state.income.mockResolvedValue({
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
      <InvestmentIncomeForm position={target} />
    </QueryClientProvider>
  )
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function basic() {
  fill("Valor bruto recebido", "100,00")
  fill("Data da operação", "2026-09-01")
  fill("Categoria de rendimento", "income-1")
}

describe("InvestmentIncomeForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.accounts = [
      { id: "wallet-1", name: "Carteira", currency: "BRL", status: "ACTIVE" },
    ]
  })

  it("requires an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })

  it("shows only income fields without quantity, cost or external route", () => {
    success()
    renderForm()
    expect(screen.getByLabelText("Valor bruto recebido")).toBeTruthy()
    expect(screen.queryByLabelText("Quantidade")).toBeNull()
    expect(
      screen.queryByLabelText("Custo da parte vendida/resgatada")
    ).toBeNull()
    expect(screen.queryByLabelText("Conta de destino")).toBeNull()
  })

  it("allows income on a closed position without reopening it", async () => {
    success()
    renderForm({
      ...position,
      status: "CLOSED",
      quantity: "0",
      bookCostMinor: "0",
    })
    basic()
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(state.income).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: "position-1",
          expectedPositionVersion: 4,
          type: "INCOME",
          grossAmountMinor: "10000",
          cashMode: "INTERNAL_CASH",
        })
      )
    )
    expect(state.income.mock.calls[0][0]).not.toHaveProperty("quantityDelta")
    expect(state.income.mock.calls[0][0]).not.toHaveProperty(
      "bookCostReductionMinor"
    )
  })

  it("rejects zero gross income", async () => {
    success()
    renderForm()
    fill("Valor bruto recebido", "0")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/bruto maior que zero/)).toBeTruthy()
    )
    expect(state.income).not.toHaveBeenCalled()
  })

  it("requires an active income category", async () => {
    success()
    renderForm()
    fill("Valor bruto recebido", "100,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/categoria de rendimento/)).toBeTruthy()
    )
    expect(state.income).not.toHaveBeenCalled()
  })

  it("requires expense categories only for nonzero fees and taxes", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/categoria de taxas/)).toBeTruthy()
    )
    fill("Categoria de taxas", "fee-1")
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/categoria de impostos/)).toBeTruthy()
    )
    expect(state.income).not.toHaveBeenCalled()
  })

  it("rejects retention greater than gross", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "101,00")
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/líquido não pode ser negativo/)).toBeTruthy()
    )
    expect(state.income).not.toHaveBeenCalled()
  })

  it("submits gross 100 and tax 20 as one INCOME with net 80", async () => {
    success()
    renderForm()
    basic()
    fill("Impostos", "20,00")
    fill("Categoria de impostos", "tax-1")
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            type: "INCOME",
            expectedPositionVersion: 4,
            grossAmountMinor: "10000",
            taxesMinor: "2000",
            incomeCategoryId: "income-1",
            taxCategoryId: "tax-1",
            cashMode: "INTERNAL_CASH",
          }),
        })
      )
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(state.income).toHaveBeenCalledWith(
        expect.objectContaining({
          grossAmountMinor: "10000",
          taxesMinor: "2000",
          incomeCategoryId: "income-1",
          taxCategoryId: "tax-1",
        })
      )
    )
    expect(state.income).toHaveBeenCalledTimes(1)
  })

  it("keeps fees and taxes in the INCOME command without separate expense operations", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    fill("Categoria de taxas", "fee-1")
    fill("Categoria de impostos", "tax-1")
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(state.income).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "INCOME",
          feesMinor: "1000",
          taxesMinor: "500",
          feeCategoryId: "fee-1",
          taxCategoryId: "tax-1",
        })
      )
    )
    expect(state.income).toHaveBeenCalledTimes(1)
  })

  it("renders preview gross result, net flow, postings and categories", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "0",
        netCashFlowMinor: "8000",
        postings: [
          { accountId: "wallet-1", amountMinor: "8000" },
          { accountId: "income-1", amountMinor: "-10000" },
          { accountId: "tax-1", amountMinor: "2000" },
        ],
        categories: { incomeCategoryId: "income-1", taxCategoryId: "tax-1" },
        projectedCashMinor: "58000",
        warnings: [],
      },
    })
    renderForm()
    basic()
    fill("Impostos", "20,00")
    fill("Categoria de impostos", "tax-1")
    await waitFor(() =>
      expect(screen.getByText(/Custo: R\$\s*0,00/)).toBeTruthy()
    )
    expect(screen.getByText(/Fluxo líquido: R\$\s*80,00/)).toBeTruthy()
    expect(screen.getByText(/Carteira: R\$\s*80,00/)).toBeTruthy()
    expect(screen.getByText(/Rendimentos: -R\$\s*100,00/)).toBeTruthy()
    expect(screen.getByText(/Impostos: R\$\s*20,00/)).toBeTruthy()
    expect(
      screen.getByText(/Categoria de rendimento: Rendimentos/)
    ).toBeTruthy()
    expect(screen.getByText(/Categoria de impostos: Impostos/)).toBeTruthy()
  })

  it("shows negative-cash warning without disabling Save", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "0",
        netCashFlowMinor: "10000",
        postings: [],
        categories: {},
        projectedCashMinor: "-10000",
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "wallet-1",
            cashMinor: "-10000",
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
      screen.getByRole("button", { name: "Registrar rendimento" })
    ).not.toHaveProperty("disabled", true)
  })

  it("locks repeated submission while pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.income.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    basic()
    const save = screen.getByRole("button", { name: "Registrar rendimento" })
    fireEvent.click(save)
    await waitFor(() => expect(save).toHaveProperty("disabled", true))
    fireEvent.click(save)
    expect(state.income).toHaveBeenCalledTimes(1)
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
    await waitFor(() => expect(save).toHaveProperty("disabled", false))
  })

  it("preserves fields and requestId after failed submission", async () => {
    success()
    state.income
      .mockResolvedValueOnce({ ok: false, error: { code: "TEMPORARY" } })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          requestId: "request-1",
          positionId: "position-1",
          operationId: "operation-1",
          journalEntryIds: ["entry-1"],
          warnings: [],
        },
      })
    renderForm()
    basic()
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/tente novamente/i)).toBeTruthy()
    )
    expect(screen.getByLabelText("Valor bruto recebido")).toHaveProperty(
      "value",
      "100,00"
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() => expect(state.income).toHaveBeenCalledTimes(2))
    expect(state.income.mock.calls[1][0].requestId).toBe(
      state.income.mock.calls[0][0].requestId
    )
  })

  it("reports CAS conflict with reload instruction", async () => {
    success()
    state.income.mockResolvedValue({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    renderForm()
    basic()
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar rendimento" })
    )
    await waitFor(() =>
      expect(screen.getByText(/Atualize a posição/)).toBeTruthy()
    )
  })
})
