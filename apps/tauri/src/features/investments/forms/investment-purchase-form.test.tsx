/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InvestmentPositionView } from "@workspace/application"
import { InvestmentPurchaseForm } from "./investment-purchase-form"

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
  categories: [
    { id: "fee-1", name: "Taxas" },
    { id: "tax-1", name: "Impostos" },
  ],
  preview: vi.fn(),
  purchase: vi.fn(),
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
        purchase: { execute: state.purchase },
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
  useExpenseCategories: () => ({ data: state.categories }),
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

const basePosition: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB",
  assetClass: "FIXED_INCOME",
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
      bookCostDeltaMinor: "10000",
      netCashFlowMinor: "-10000",
      postings: [],
      categories: {},
      projectedCashMinor: "90000",
      warnings: [],
    },
  })
  state.purchase.mockResolvedValue({
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

function renderForm(
  position: InvestmentPositionView = basePosition,
  onSuccess = vi.fn()
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <InvestmentPurchaseForm position={position} onSuccess={onSuccess} />
    </QueryClientProvider>
  )
  return onSuccess
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function choose(label: string, value: string) {
  const group = screen.queryByRole("group", { name: label })
  if (group) {
    fireEvent.click(group.querySelector('input[value="' + value + '"]')!)
  } else {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

function basic() {
  fill("Principal", "100,00")
  fill("Data da operação", "2026-09-01")
}

describe("InvestmentPurchaseForm", () => {
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
    state.categories = [
      { id: "fee-1", name: "Taxas" },
      { id: "tax-1", name: "Impostos" },
    ]
  })

  it("requires an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })

  it("labels fixed income as application", () => {
    success()
    renderForm()
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy()
  })

  it("blocks a closed position before offering a purchase", () => {
    success()
    renderForm({ ...basePosition, status: "CLOSED" })
    expect(screen.getByText(/Posição encerrada/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull()
    expect(state.preview).not.toHaveBeenCalled()
    expect(state.purchase).not.toHaveBeenCalled()
  })

  it("labels negotiated assets as purchase", () => {
    success()
    renderForm({
      ...basePosition,
      assetClass: "EQUITY",
      instrumentName: "Ação",
    })
    expect(screen.getByRole("button", { name: "Comprar" })).toBeTruthy()
  })

  it("submits internal application with real position CAS and no invented quantity", async () => {
    success()
    renderForm()
    basic()
    await waitFor(() => expect(state.preview).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(state.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: "book-1",
          positionId: "position-1",
          expectedPositionVersion: 4,
          type: "APPLICATION",
          capitalMinor: "10000",
          funding: { mode: "INTERNAL_CASH" },
        })
      )
    )
    expect(state.purchase.mock.calls[0][0]).not.toHaveProperty("quantityDelta")
  })

  it("requires a positive principal", async () => {
    success()
    renderForm()
    fill("Principal", "0")
    fill("Data da operação", "2026-09-01")
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(screen.getByText(/principal maior que zero/i)).toBeTruthy()
    )
    expect(state.purchase).not.toHaveBeenCalled()
  })

  it("requires a quantity for unit-controlled positions", async () => {
    success()
    renderForm({ ...basePosition, assetClass: "EQUITY", quantity: "10" })
    basic()
    fireEvent.click(screen.getByRole("button", { name: "Comprar" }))
    await waitFor(() =>
      expect(screen.getByText(/Informe a quantidade/)).toBeTruthy()
    )
    expect(state.purchase).not.toHaveBeenCalled()
    fill("Quantidade", "2,5")
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({ quantityDelta: "2.5" }),
        })
      )
    )
  })

  it("requires categories only when their expense is nonzero", async () => {
    success()
    renderForm()
    basic()
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(screen.getByText(/categoria de taxas/i)).toBeTruthy()
    )
    choose("Categoria de taxas", "fee-1")
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(screen.getByText(/categoria de impostos/i)).toBeTruthy()
    )
    expect(state.purchase).not.toHaveBeenCalled()
  })

  it("keeps capital separate from settled fees and taxes", async () => {
    success()
    renderForm()
    basic()
    fill("Principal", "1000,00")
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    choose("Categoria de taxas", "fee-1")
    choose("Categoria de impostos", "tax-1")
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            capitalMinor: "100000",
            feesMinor: "1000",
            taxesMinor: "500",
            feeCategoryId: "fee-1",
            taxCategoryId: "tax-1",
          }),
        })
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(state.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          capitalMinor: "100000",
          feesMinor: "1000",
          taxesMinor: "500",
          feeCategoryId: "fee-1",
          taxCategoryId: "tax-1",
        })
      )
    )
  })

  it("renders planner preview cost, flow, postings and expense categories", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "100000",
        netCashFlowMinor: "-101500",
        postings: [
          { accountId: "wallet-1", amountMinor: "-1500" },
          { accountId: "fee-1", amountMinor: "1000" },
          { accountId: "tax-1", amountMinor: "500" },
        ],
        categories: { feeCategoryId: "fee-1", taxCategoryId: "tax-1" },
        projectedCashMinor: "48500",
        warnings: [],
      },
    })
    renderForm()
    basic()
    fill("Principal", "1000,00")
    fill("Taxas", "10,00")
    fill("Impostos", "5,00")
    choose("Categoria de taxas", "fee-1")
    choose("Categoria de impostos", "tax-1")
    await waitFor(() =>
      expect(screen.getByText(/Custo: R\$\s*1\.000,00/)).toBeTruthy()
    )
    expect(screen.getByText(/Fluxo líquido: -R\$\s*1\.015,00/)).toBeTruthy()
    expect(screen.getByText(/Carteira: -R\$\s*15,00/)).toBeTruthy()
    expect(screen.getByText(/Categoria de taxas: Taxas/)).toBeTruthy()
    expect(screen.getByText(/Categoria de impostos: Impostos/)).toBeTruthy()
  })

  it("preselects settlement only after explicitly choosing external funding", async () => {
    success()
    renderForm()
    basic()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            funding: { mode: "INTERNAL_CASH" },
          }),
        })
      )
    )
    choose("Origem do dinheiro", "EXTERNAL_ACCOUNT")
    await waitFor(() =>
      expect(screen.getByLabelText("Conta de origem")).toHaveProperty(
        "value",
        "bank-1"
      )
    )
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
          }),
        })
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(state.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
        })
      )
    )
  })

  it("rejects external funding without an explicit account", async () => {
    success()
    state.accounts[0] = {
      ...state.accounts[0],
      defaultSettlementAccountId: undefined,
    }
    renderForm()
    basic()
    choose("Origem do dinheiro", "EXTERNAL_ACCOUNT")
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(screen.getByText(/Escolha a conta de origem/)).toBeTruthy()
    )
    expect(state.purchase).not.toHaveBeenCalled()
  })

  it("shows negative-cash warning without blocking Save", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 4,
        allocationRevision: 2,
        bookCostDeltaMinor: "10000",
        netCashFlowMinor: "-10000",
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
    expect(screen.getByRole("button", { name: "Aplicar" })).not.toHaveProperty(
      "disabled",
      true
    )
  })

  it("locks repeat submission while pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.purchase.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    basic()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Aplicar" })
      ).not.toHaveProperty("disabled", true)
    )
    const save = screen.getByRole("button", { name: "Aplicar" })
    fireEvent.click(save)
    await waitFor(() => expect(save).toHaveProperty("disabled", true))
    fireEvent.click(save)
    expect(state.purchase).toHaveBeenCalledTimes(1)
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

  it("preserves draft and requestId after a failed submission", async () => {
    success()
    state.purchase
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
    basic()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Aplicar" })
      ).not.toHaveProperty("disabled", true)
    )
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(screen.getByText(/tente novamente/i)).toBeTruthy()
    )
    expect(screen.getByLabelText("Principal")).toHaveProperty("value", "100,00")
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() => expect(state.purchase).toHaveBeenCalledTimes(2))
    expect(state.purchase.mock.calls[1][0].requestId).toBe(
      state.purchase.mock.calls[0][0].requestId
    )
  })

  it("reports version conflicts with an actionable reload instruction", async () => {
    success()
    state.purchase.mockResolvedValue({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    renderForm()
    basic()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Aplicar" })
      ).not.toHaveProperty("disabled", true)
    )
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }))
    await waitFor(() =>
      expect(screen.getByText(/Atualize a posição/)).toBeTruthy()
    )
  })
})
