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
import { InvestmentSaleForm } from "./investment-sale-form"
import { correctionOperation } from "./investment-correction-test-fixtures"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  accounts: [
    {
      id: "wallet-1",
      name: "Carteira",
      currency: "BRL",
      status: "ACTIVE",
      defaultSettlementAccountId: "bank-1",
    },
  ] as Array<Record<string, unknown>>,
  balances: [
    {
      accountId: "bank-1",
      accountName: "Banco",
      accountKind: "ASSET",
      currency: "BRL",
      archived: false,
      financialAccount: { type: "BANK_ACCOUNT" },
    },
  ] as Array<Record<string, unknown>>,
  expenses: [
    { id: "loss-1", name: "Perdas" },
    { id: "fee-1", name: "Taxas" },
    { id: "tax-1", name: "Impostos" },
  ],
  incomes: [{ id: "gain-1", name: "Ganhos" }],
  preview: vi.fn(),
  sale: vi.fn(),
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
        sale: { execute: state.sale },
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
vi.mock("../../accounts/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../accounts/hooks")>()),
  useAccountBalances: () => ({ data: state.balances }),
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
      bookCostDeltaMinor: "-40000",
      netCashFlowMinor: "50000",
      postings: [],
      categories: {},
      projectedCashMinor: "60000",
      warnings: [],
    },
  })
  state.sale.mockResolvedValue({
    ok: true,
    value: {
      requestId: "request-1",
      positionId: "position-1",
      positionVersion: 5,
      allocationRevision: 3,
      operationId: "operation-1",
      journalEntryIds: [],
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
      <InvestmentSaleForm position={target} />
    </QueryClientProvider>
  )
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function choose(label: string, value: string) {
  const group = screen.queryByRole("group", { name: label })
  if (group)
    fireEvent.click(group.querySelector('input[value="' + value + '"]')!)
  else fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function partial() {
  fill("Custo da parte vendida/resgatada", "400,00")
  fill("Quantidade", "2")
  fill("Valor bruto recebido", "500,00")
  fill("Data da operação", "2026-09-01")
  choose("Categoria de ganho", "gain-1")
}

function renderCorrection(operation: ReturnType<typeof correctionOperation>) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <InvestmentSaleForm
        position={position}
        amendment={{ operation, reason: "Ajuste justificado" }}
      />
    </QueryClientProvider>
  )
}

describe("InvestmentSaleForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.accounts = [
      {
        id: "wallet-1",
        name: "Carteira",
        currency: "BRL",
        status: "ACTIVE",
        defaultSettlementAccountId: "bank-1",
      },
    ]
    state.balances = [
      {
        accountId: "bank-1",
        accountName: "Banco",
        accountKind: "ASSET",
        currency: "BRL",
        archived: false,
        financialAccount: { type: "BANK_ACCOUNT" },
      },
    ]
  })

  it("requires an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })

  it("labels fixed income redemption", () => {
    success()
    renderForm()
    expect(screen.getByRole("button", { name: "Resgatar" })).toBeTruthy()
  })

  it("labels negotiated assets sale", () => {
    success()
    renderForm({ ...position, assetClass: "EQUITY" })
    expect(screen.getByRole("button", { name: "Vender" })).toBeTruthy()
  })

  it("does not offer exit for a closed position", () => {
    success()
    renderForm({ ...position, status: "CLOSED" })
    expect(screen.getByText(/Posição encerrada/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Resgatar" })).toBeNull()
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("fills exact remaining cost and units for total exit while leaving gross explicit", async () => {
    success()
    renderForm()
    choose("Extensão da saída", "TOTAL")
    await waitFor(() =>
      expect(
        screen.getByLabelText("Custo da parte vendida/resgatada")
      ).toHaveProperty("value", "5000,00")
    )
    expect(screen.getByLabelText("Quantidade")).toHaveProperty("value", "10")
    expect(screen.getByLabelText("Valor bruto recebido")).toHaveProperty(
      "value",
      ""
    )
  })

  it("submits a total redemption with exact remaining allocation and explicit gross, tax and bank", async () => {
    success()
    renderForm()
    choose("Extensão da saída", "TOTAL")
    fill("Valor bruto recebido", "5100,00")
    fill("Impostos", "20,00")
    fill("Data da operação", "2026-09-01")
    choose("Categoria de ganho", "gain-1")
    choose("Categoria de impostos", "tax-1")
    choose("Destino do dinheiro", "EXTERNAL_ACCOUNT")
    await waitFor(() =>
      expect(screen.getByLabelText("Conta de destino")).toHaveProperty(
        "value",
        "bank-1"
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(state.sale).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "REDEMPTION",
          quantityDelta: "10",
          bookCostReductionMinor: "500000",
          grossProceedsMinor: "510000",
          taxesMinor: "2000",
          gainCategoryId: "gain-1",
          taxCategoryId: "tax-1",
          destination: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
        })
      )
    )
  })

  it("requires explicit cost again after changing total exit to partial", async () => {
    success()
    renderForm()
    choose("Extensão da saída", "TOTAL")
    await waitFor(() =>
      expect(
        screen.getByLabelText("Custo da parte vendida/resgatada")
      ).toHaveProperty("value", "5000,00")
    )
    choose("Extensão da saída", "PARTIAL")
    await waitFor(() =>
      expect(
        screen.getByLabelText("Custo da parte vendida/resgatada")
      ).toHaveProperty("value", "")
    )
    expect(screen.getByLabelText("Quantidade")).toHaveProperty("value", "")
  })

  it("submits partial redemption with explicit cost, units and real CAS", async () => {
    success()
    renderForm()
    partial()
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(state.sale).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          positionId: "position-1",
          expectedPositionVersion: 4,
          type: "REDEMPTION",
          quantityDelta: "2",
          bookCostReductionMinor: "40000",
          grossProceedsMinor: "50000",
          destination: { mode: "INTERNAL_CASH" },
          gainCategoryId: "gain-1",
        })
      )
    )
  })

  it("does not invent quantity for an amount-controlled position", async () => {
    success()
    renderForm({ ...position, quantity: undefined })
    expect(screen.queryByLabelText("Quantidade")).toBeNull()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Valor bruto recebido", "500,00")
    fill("Data da operação", "2026-09-01")
    choose("Categoria de ganho", "gain-1")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() => expect(state.sale).toHaveBeenCalled())
    expect(state.sale.mock.calls[0][0]).not.toHaveProperty("quantityDelta")
  })

  it("requires explicit partial cost without inferring average cost", async () => {
    success()
    renderForm()
    fill("Quantidade", "2")
    fill("Valor bruto recebido", "500,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/Informe o custo retirado/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("rejects cost greater than the position cost", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "5000,01")
    fill("Quantidade", "2")
    fill("Valor bruto recebido", "5000,01")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/excede o custo da posição/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("requires quantity on a units position", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Valor bruto recebido", "500,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/Informe a quantidade/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("rejects a quantity beyond the available units", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Quantidade", "11")
    fill("Valor bruto recebido", "500,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/excede as unidades disponíveis/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("rejects reducing all units while retaining cost", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Quantidade", "10")
    fill("Valor bruto recebido", "500,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/Retire todo o custo/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("allows zero-cost units sale with an explicit zero", async () => {
    success()
    renderForm({ ...position, bookCostMinor: "0", assetClass: "EQUITY" })
    fill("Custo da parte vendida/resgatada", "0")
    fill("Quantidade", "2")
    fill("Valor bruto recebido", "100,00")
    fill("Data da operação", "2026-09-01")
    choose("Categoria de ganho", "gain-1")
    fireEvent.click(screen.getByRole("button", { name: "Vender" }))
    await waitFor(() =>
      expect(state.sale).toHaveBeenCalledWith(
        expect.objectContaining({
          bookCostReductionMinor: "0",
          quantityDelta: "2",
          grossProceedsMinor: "10000",
        })
      )
    )
  })

  it("rejects net proceeds below zero", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Quantidade", "2")
    fill("Valor bruto recebido", "10,00")
    fill("Taxas", "20,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/líquido não pode ser negativo/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("requires gain category only for positive gross result", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Quantidade", "2")
    fill("Valor bruto recebido", "500,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/categoria de ganho/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("requires loss category only for negative gross result", async () => {
    success()
    renderForm()
    fill("Custo da parte vendida/resgatada", "400,00")
    fill("Quantidade", "2")
    fill("Valor bruto recebido", "300,00")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/categoria de perda/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
    choose("Categoria de perda", "loss-1")
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            lossCategoryId: "loss-1",
            grossProceedsMinor: "30000",
          }),
        })
      )
    )
  })

  it("requires categories for settled fees and taxes", async () => {
    success()
    renderForm()
    partial()
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/categoria de taxas/)).toBeTruthy()
    )
    choose("Categoria de taxas", "fee-1")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/categoria de impostos/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("submits gross, cost, expenses and categories in one sale command", async () => {
    success()
    renderForm()
    partial()
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    choose("Categoria de taxas", "fee-1")
    choose("Categoria de impostos", "tax-1")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(state.sale).toHaveBeenCalledWith(
        expect.objectContaining({
          bookCostReductionMinor: "40000",
          grossProceedsMinor: "50000",
          feesMinor: "1000",
          taxesMinor: "500",
          gainCategoryId: "gain-1",
          feeCategoryId: "fee-1",
          taxCategoryId: "tax-1",
        })
      )
    )
  })

  it("shows preview of cost, net flow, account postings and categories", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "-40000",
        netCashFlowMinor: "48500",
        postings: [
          { accountId: "wallet-1", amountMinor: "8500" },
          { accountId: "gain-1", amountMinor: "-10000" },
          { accountId: "fee-1", amountMinor: "1000" },
          { accountId: "tax-1", amountMinor: "500" },
        ],
        categories: {
          gainCategoryId: "gain-1",
          feeCategoryId: "fee-1",
          taxCategoryId: "tax-1",
        },
        projectedCashMinor: "98500",
        warnings: [],
      },
    })
    renderForm()
    partial()
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    choose("Categoria de taxas", "fee-1")
    choose("Categoria de impostos", "tax-1")
    await waitFor(() =>
      expect(screen.getByText(/Custo: -R\$\s*400,00/)).toBeTruthy()
    )
    expect(screen.getByText(/Fluxo líquido: R\$\s*485,00/)).toBeTruthy()
    expect(screen.getByText(/Carteira: R\$\s*85,00/)).toBeTruthy()
    expect(screen.getByText(/Categoria de ganho: Ganhos/)).toBeTruthy()
    expect(screen.getByText(/Categoria de impostos: Impostos/)).toBeTruthy()
  })

  it("preselects settlement only after explicit external destination", async () => {
    success()
    renderForm()
    partial()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            destination: { mode: "INTERNAL_CASH" },
          }),
        })
      )
    )
    choose("Destino do dinheiro", "EXTERNAL_ACCOUNT")
    await waitFor(() =>
      expect(screen.getByLabelText("Conta de destino")).toHaveProperty(
        "value",
        "bank-1"
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(state.sale).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
        })
      )
    )
  })

  it("rejects external destination without an account", async () => {
    success()
    state.accounts[0] = {
      ...state.accounts[0],
      defaultSettlementAccountId: undefined,
    }
    renderForm()
    partial()
    choose("Destino do dinheiro", "EXTERNAL_ACCOUNT")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/Escolha a conta de destino/)).toBeTruthy()
    )
    expect(state.sale).not.toHaveBeenCalled()
  })

  it("shows negative-cash warning without disabling Save", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "-40000",
        netCashFlowMinor: "50000",
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
    partial()
    await waitFor(() =>
      expect(screen.getByText(/Possível caixa negativo/)).toBeTruthy()
    )
    expect(screen.getByRole("button", { name: "Resgatar" })).not.toHaveProperty(
      "disabled",
      true
    )
  })

  it("locks a repeated submission while pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.sale.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    partial()
    const save = screen.getByRole("button", { name: "Resgatar" })
    fireEvent.click(save)
    await waitFor(() => expect(save).toHaveProperty("disabled", true))
    fireEvent.click(save)
    expect(state.sale).toHaveBeenCalledTimes(1)
    complete?.({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        operationId: "operation-1",
        journalEntryIds: [],
        warnings: [],
      },
    })
    await waitFor(() => expect(save).toHaveProperty("disabled", false))
  })

  it("preserves fields and requestId after failed submission", async () => {
    success()
    state.sale
      .mockResolvedValueOnce({ ok: false, error: { code: "TEMPORARY" } })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          requestId: "request-1",
          positionId: "position-1",
          operationId: "operation-1",
          journalEntryIds: [],
          warnings: [],
        },
      })
    renderForm()
    partial()
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/tente novamente/i)).toBeTruthy()
    )
    expect(
      screen.getByLabelText("Custo da parte vendida/resgatada")
    ).toHaveProperty("value", "400,00")
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() => expect(state.sale).toHaveBeenCalledTimes(2))
    expect(state.sale.mock.calls[1][0].requestId).toBe(
      state.sale.mock.calls[0][0].requestId
    )
  })

  it("reports CAS conflicts with a reload instruction", async () => {
    success()
    state.sale.mockResolvedValue({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    renderForm()
    partial()
    fireEvent.click(screen.getByRole("button", { name: "Resgatar" }))
    await waitFor(() =>
      expect(screen.getByText(/Atualize a posição/)).toBeTruthy()
    )
  })
  it("amends the original REDEMPTION through its specialized fields", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "0",
        netCashFlowMinor: "1234",
        postings: [{ accountId: "wallet-1", amountMinor: "1234" }],
        categories: { gainCategoryId: "gain-1" },
        projectedCashMinor: "61234",
        warnings: [],
      },
    })
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
      correctionOperation("REDEMPTION", {
        bookCostDeltaMinor: "-40000",
        grossAmountMinor: "50000",
        quantityDelta: "-2",
        beforeQuantity: "10",
        gainCategoryId: "gain-1",
      })
    )
    expect(
      screen.getByLabelText("Custo da parte vendida/resgatada")
    ).toHaveProperty("value", "400,00")
    await waitFor(() =>
      expect(screen.getByText(/Fluxo líquido: R\$\s*12,34/)).toBeTruthy()
    )
    expect(screen.getByText(/Carteira: R\$\s*12,34/)).toBeTruthy()
    fill("Data da operação", "2026-09-02")
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() =>
      expect(state.amend).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: "operation-original",
          expectedOperationVersion: 0,
          expectedPositionVersion: 4,
          reason: "Ajuste justificado",
          replacement: expect.objectContaining({
            bookCostReductionMinor: "40000",
            grossProceedsMinor: "50000",
            occurredOn: "2026-09-02",
            type: "REDEMPTION",
          }),
        })
      )
    )
    expect(state.sale).not.toHaveBeenCalled()
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

  it("preserves an amendment draft and requestId after a version conflict", async () => {
    success()
    state.amend.mockResolvedValueOnce({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    state.amend.mockResolvedValue({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        positionVersion: 5,
        replacementOperationId: "replacement-1",
        journalEntryIds: [],
        warnings: [],
      },
    })
    renderCorrection(
      correctionOperation("REDEMPTION", {
        bookCostDeltaMinor: "-40000",
        grossAmountMinor: "50000",
        quantityDelta: "-2",
        beforeQuantity: "10",
        gainCategoryId: "gain-1",
      })
    )
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() =>
      expect(screen.getByText(/Recarregue o histórico/)).toBeTruthy()
    )
    expect(
      screen.getByLabelText("Custo da parte vendida/resgatada")
    ).toHaveProperty("value", "400,00")
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => expect(state.amend).toHaveBeenCalledTimes(2))
    expect(state.amend.mock.calls[1][0].requestId).toBe(
      state.amend.mock.calls[0][0].requestId
    )
  })
})
