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
import { OpenInvestmentPositionForm } from "./open-investment-position-form"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "INACTIVE" },
  book: { data: { baseCurrency: "BRL" }, isPending: false, isError: false } as {
    data?: { baseCurrency: string }
    isPending: boolean
    isError: boolean
  },
  accounts: [
    {
      id: "wallet-1",
      name: "Carteira",
      currency: "BRL",
      status: "ACTIVE",
      cashMinor: "100000",
      defaultSettlementAccountId: "bank-1",
    },
  ] as Array<Record<string, unknown>>,
  instruments: [
    {
      id: "instrument-1",
      name: "CDB",
      type: "CDB",
      currency: "BRL",
      status: "ACTIVE",
      identifiers: [],
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
  open: vi.fn(),
  purchase: vi.fn(),
  openingBalance: vi.fn(),
  preview: vi.fn(),
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
      accounts: { setOpeningBalance: { execute: state.openingBalance } },
      positions: {
        open: { execute: state.open },
        openWithPurchase: { execute: state.purchase },
        previewOpening: { execute: state.preview },
      },
      requests: { get: state.receipt },
    },
  }),
}))
vi.mock("../../books/hooks", () => ({ useBookDetail: () => state.book }))
vi.mock("../../accounts/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../accounts/hooks")>()),
  useAccountBalances: () => ({
    data: state.balances,
    isPending: false,
    isError: false,
  }),
}))
vi.mock("../hooks", () => ({
  useInvestmentAccounts: () => ({
    data: state.accounts,
    isPending: false,
    isError: false,
  }),
  useInvestmentInstruments: () => ({
    data: state.instruments,
    isPending: false,
    isError: false,
  }),
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
        {options.map((item: MockOption) => (
          <option key={item.value} value={item.value}>
            {item.label}
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
      {options.map((item: MockOption) => (
        <label key={item.value}>
          <input
            type="radio"
            name={name}
            value={item.value}
            checked={control._formValues[name] === item.value}
            onChange={(event) => changeValue(control, name, event.target.value)}
          />
          {item.label}
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
vi.mock("../../accounts/components/account-form", () => ({
  AccountForm: ({ onSuccess }: { onSuccess: (id: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        state.accounts.push({
          id: "wallet-2",
          name: "Nova carteira",
          currency: "BRL",
          status: "ACTIVE",
          cashMinor: "0",
        })
        onSuccess("wallet-2")
      }}
    >
      Confirmar carteira
    </button>
  ),
}))
vi.mock("./investment-instrument-form", () => ({
  InvestmentInstrumentForm: ({
    onSuccess,
  }: {
    onSuccess: (created: { id: string }) => void
  }) => (
    <button
      type="button"
      onClick={() => {
        const item = {
          id: "instrument-2",
          name: "Novo CDB",
          type: "CDB",
          currency: "BRL",
          status: "ACTIVE",
          identifiers: [],
        }
        state.instruments.push(item)
        onSuccess(item)
      }}
    >
      Confirmar instrumento
    </button>
  ),
}))

function renderForm(onSuccess = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <OpenInvestmentPositionForm onSuccess={onSuccess} />
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
    fireEvent.click(group.querySelector(`input[value="${value}"]`)!)
  } else {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

function selectInstrument(name = "CDB") {
  fill("Instrumento", name)
  fireEvent.click(screen.getByRole("option", { name: new RegExp(name, "i") }))
}

function continueFlow() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
}

function startPosition(mode: "OWNED" | "BUY" = "OWNED", instrument = "CDB") {
  if (mode === "BUY") choose("Modo de abertura", "BUY")
  selectInstrument(instrument)
  choose("Carteira", "wallet-1")
  continueFlow()
}

function fillPosition(mode: "OWNED" | "BUY" = "OWNED", value = "100,00") {
  fill(mode === "BUY" ? "Valor principal" : "Custo contábil", value)
  fill(
    mode === "BUY" ? "Data da compra ou aplicação" : "Data da abertura",
    "2026-09-01"
  )
}

function reachAccounting(mode: "OWNED" | "BUY" = "OWNED", instrument = "CDB") {
  startPosition(mode, instrument)
  fillPosition(mode)
  continueFlow()
}

async function reachReview(
  mode: "OWNED" | "BUY" = "OWNED",
  origin:
    | "INTERNAL_CASH"
    | "EXTERNAL_ACCOUNT"
    | "NOT_RECORDED" = "INTERNAL_CASH"
) {
  reachAccounting(mode)
  choose(mode === "BUY" ? "Origem do dinheiro" : "Situação atual", origin)
  continueFlow()
  await waitFor(() => expect(state.preview).toHaveBeenCalled())
}

async function submitInvestment() {
  const button = screen.getByRole("button", { name: "Confirmar investimento" })
  await waitFor(() => expect(button).not.toHaveProperty("disabled", true))
  fireEvent.click(button)
}

function successfulOpeningBalancePreview(amount = "10000", cash = "0") {
  state.preview.mockResolvedValue({
    ok: true,
    value: {
      bookCostDeltaMinor: "10000",
      netCashFlowMinor: "0",
      postings: [],
      categories: {},
      openingBalanceMinor: amount,
      projectedCashMinor: cash,
      warnings: [],
    },
  })
}

function success() {
  state.preview.mockResolvedValue({
    ok: true,
    value: {
      bookCostDeltaMinor: "12345",
      netCashFlowMinor: "-12345",
      postings: [],
      categories: {},
      projectedCashMinor: "87655",
      warnings: [],
    },
  })
  state.open.mockResolvedValue({
    ok: true,
    value: {
      requestId: "open",
      positionId: "position-1",
      journalEntryIds: [],
      warnings: [],
    },
  })
  state.purchase.mockResolvedValue({
    ok: true,
    value: {
      requestId: "buy",
      positionId: "position-1",
      journalEntryIds: [],
      warnings: [],
    },
  })
  state.openingBalance.mockResolvedValue({
    ok: true,
    value: {
      requestId: "balance",
      journalEntryIds: ["journal-1"],
      warnings: [],
    },
  })
  state.receipt.mockResolvedValue(null)
}

describe("OpenInvestmentPositionForm", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.book = {
      data: { baseCurrency: "BRL" },
      isPending: false,
      isError: false,
    }
    state.accounts = [
      {
        id: "wallet-1",
        name: "Carteira",
        currency: "BRL",
        status: "ACTIVE",
        cashMinor: "100000",
        defaultSettlementAccountId: "bank-1",
      },
    ]
    state.instruments = [
      {
        id: "instrument-1",
        name: "CDB",
        type: "CDB",
        currency: "BRL",
        status: "ACTIVE",
        identifiers: [],
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

  it("starts with the two scenarios and hides later decisions", () => {
    success()
    renderForm()
    expect(screen.getByRole("group", { name: "Modo de abertura" })).toBeTruthy()
    expect(screen.getByText("Já tenho este investimento")).toBeTruthy()
    expect(screen.getByText("Estou comprando ou aplicando")).toBeTruthy()
    expect(screen.queryByText("Situação atual")).toBeNull()
    expect(screen.queryByLabelText("Custo contábil")).toBeNull()
  })
  it("offers three accounting origins for existing holdings", () => {
    success()
    renderForm()
    reachAccounting()
    expect(screen.getByText("Já está no caixa da carteira")).toBeTruthy()
    expect(screen.getByText("Saiu de outra conta")).toBeTruthy()
    expect(screen.getByText("Ainda não aparece no My Fin")).toBeTruthy()
  })
  it("requires an active book", () => {
    state.session = { status: "INACTIVE" }
    renderForm()
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })
  it("waits for book currency", () => {
    state.book = { data: undefined, isPending: true, isError: false }
    renderForm()
    expect(screen.getByText(/Carregando moeda/)).toBeTruthy()
  })
  it("shows a recoverable book error", () => {
    state.book = { data: undefined, isPending: false, isError: true }
    renderForm()
    expect(screen.getByText(/Não foi possível carregar a moeda/)).toBeTruthy()
  })
  it("allows a separately created wallet", () => {
    success()
    renderForm()
    choose("Modo de abertura", "BUY")
    fireEvent.click(screen.getByRole("button", { name: "Nova carteira" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmar carteira" }))
    expect(screen.getByLabelText("Carteira")).toHaveProperty(
      "value",
      "wallet-2"
    )
    expect(
      screen
        .getByRole("group", { name: "Modo de abertura" })
        .querySelector('input[value="BUY"]')
    ).toHaveProperty("checked", true)
  })
  it("allows a separately created instrument", () => {
    success()
    renderForm()
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar novo instrumento" })
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar instrumento" })
    )
    expect(
      screen
        .getByRole("option", { name: /Novo CDB/i })
        .getAttribute("aria-selected")
    ).toBe("true")
  })
  it("opens already-owned holdings without a journal when cash is in wallet", async () => {
    success()
    renderForm()
    await reachReview()
    await submitInvestment()
    await waitFor(() =>
      expect(state.open).toHaveBeenCalledWith(
        expect.objectContaining({
          investmentAccountId: "wallet-1",
          instrumentId: "instrument-1",
          bookCostMinor: "10000",
          quantityMode: "AMOUNT",
        })
      )
    )
    expect(state.purchase).not.toHaveBeenCalled()
    expect(state.openingBalance).not.toHaveBeenCalled()
  })
  it("routes an existing holding in another account through atomic external application", async () => {
    success()
    renderForm()
    await reachReview("OWNED", "EXTERNAL_ACCOUNT")
    await submitInvestment()
    await waitFor(() =>
      expect(state.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "APPLICATION",
          funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
          capitalMinor: "10000",
        })
      )
    )
    expect(state.open).not.toHaveBeenCalled()
  })
  it("requires an explicit external account", async () => {
    success()
    state.accounts[0] = {
      ...state.accounts[0],
      defaultSettlementAccountId: undefined,
    }
    renderForm()
    reachAccounting()
    choose("Situação atual", "EXTERNAL_ACCOUNT")
    continueFlow()
    await waitFor(() =>
      expect(screen.getByText(/Escolha a conta de origem/)).toBeTruthy()
    )
    expect(state.purchase).not.toHaveBeenCalled()
  })
  it("confirms missing wealth as opening balance before allocation", async () => {
    success()
    successfulOpeningBalancePreview()
    renderForm()
    await reachReview("OWNED", "NOT_RECORDED")
    expect(state.openingBalance).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Confirmar investimento" })
    ).toHaveProperty("disabled", true)
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirmar registro do saldo inicial",
      })
    )
    await submitInvestment()
    await waitFor(() =>
      expect(state.openingBalance).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "wallet-1", amountMinor: "10000" })
      )
    )
    await waitFor(() =>
      expect(state.open).toHaveBeenCalledWith(
        expect.objectContaining({ bookCostMinor: "10000" })
      )
    )
  })
  it("adds real initial cash, not valuation, to opening balance", async () => {
    success()
    successfulOpeningBalancePreview("10500", "500")
    renderForm()
    reachAccounting()
    choose("Situação atual", "NOT_RECORDED")
    fill("Caixa real que já existe na carteira", "5,00")
    continueFlow()
    await waitFor(() => expect(state.preview).toHaveBeenCalled())
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirmar registro do saldo inicial",
      })
    )
    await submitInvestment()
    await waitFor(() =>
      expect(state.openingBalance).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: "10500" })
      )
    )
  })
  it("never repeats confirmed balance after failed allocation", async () => {
    success()
    successfulOpeningBalancePreview()
    state.open
      .mockResolvedValueOnce({ ok: false, error: { code: "TEMPORARY" } })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          requestId: "open",
          positionId: "position-1",
          journalEntryIds: [],
          warnings: [],
        },
      })
    renderForm()
    await reachReview("OWNED", "NOT_RECORDED")
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirmar registro do saldo inicial",
      })
    )
    await submitInvestment()
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(1))
    await submitInvestment()
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2))
    expect(state.openingBalance).toHaveBeenCalledTimes(1)
  })
  it("preserves the existing-opening-balance conflict and directs correction", async () => {
    success()
    successfulOpeningBalancePreview()
    state.openingBalance.mockResolvedValue({
      ok: false,
      error: { code: "OPENING_BALANCE_ALREADY_SET" },
    })
    renderForm()
    await reachReview("OWNED", "NOT_RECORDED")
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Confirmar registro do saldo inicial",
      })
    )
    await submitInvestment()
    await waitFor(() =>
      expect(
        screen.getByText(/corrija o saldo inicial existente/i)
      ).toBeTruthy()
    )
    expect(state.open).not.toHaveBeenCalled()
  })
  it("requires known book cost instead of substituting valuation", async () => {
    success()
    renderForm()
    startPosition()
    expect(screen.queryByLabelText("Valor atual estimado")).toBeNull()
    continueFlow()
    await waitFor(() =>
      expect(screen.getByText(/Informe o custo contábil/)).toBeTruthy()
    )
    expect(state.open).not.toHaveBeenCalled()
  })
  it("permits zero cost with positive units", async () => {
    success()
    state.instruments = [
      {
        id: "instrument-1",
        name: "Ação",
        type: "STOCK",
        currency: "BRL",
        status: "ACTIVE",
        identifiers: [],
      },
    ]
    renderForm()
    startPosition("OWNED", "Ação")
    fillPosition("OWNED", "0")
    fill("Quantidade", "10")
    continueFlow()
    continueFlow()
    await waitFor(() => expect(state.preview).toHaveBeenCalled())
    await submitInvestment()
    await waitFor(() =>
      expect(state.open).toHaveBeenCalledWith(
        expect.objectContaining({
          quantityMode: "UNITS",
          quantity: "10",
          bookCostMinor: "0",
        })
      )
    )
  })
  it.each([
    "STOCK",
    "BDR",
    "ETF",
    "REAL_ESTATE_FUND",
    "MUTUAL_FUND",
    "CRYPTO_ASSET",
  ])("requires units for %s", async (type) => {
    success()
    state.instruments[0] = { ...state.instruments[0], type }
    renderForm()
    startPosition()
    fillPosition()
    expect(screen.queryByText("Somente pelo valor")).toBeNull()
    expect(screen.getByLabelText("Quantidade")).toBeTruthy()
    expect(state.preview).not.toHaveBeenCalled()

    continueFlow()
    await waitFor(() =>
      expect(
        screen.getAllByText(/Informe a quantidade/).length
      ).toBeGreaterThan(0)
    )
    expect(state.open).not.toHaveBeenCalled()

    fill("Quantidade", "10")
    continueFlow()
    continueFlow()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({ quantityMode: "UNITS", quantity: "10" })
      )
    )
    await submitInvestment()
    await waitFor(() =>
      expect(state.open).toHaveBeenCalledWith(
        expect.objectContaining({ quantityMode: "UNITS", quantity: "10" })
      )
    )
  })
  it("requires quantity in units mode", async () => {
    success()
    renderForm()
    startPosition()
    fillPosition()
    choose("Como você acompanha este investimento?", "UNITS")
    continueFlow()
    await waitFor(() =>
      expect(screen.getByText(/Informe a quantidade/)).toBeTruthy()
    )
    expect(state.open).not.toHaveBeenCalled()
  })
  it("does not invent a quantity in amount mode", async () => {
    success()
    renderForm()
    await reachReview()
    await submitInvestment()
    await waitFor(() => expect(state.open).toHaveBeenCalled())
    expect(state.open.mock.calls[0][0]).not.toHaveProperty("quantity")
  })
  it("accepts partial fixed-income terms", async () => {
    success()
    renderForm()
    startPosition()
    fillPosition()
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    fill("Data de vencimento", "2028-09-01")
    continueFlow()
    continueFlow()
    await waitFor(() => expect(state.preview).toHaveBeenCalled())
    await submitInvestment()
    await waitFor(() =>
      expect(state.open).toHaveBeenCalledWith(
        expect.objectContaining({
          fixedIncomeTerms: { maturityDate: "2028-09-01" },
        })
      )
    )
  })
  it("requires rate components together", async () => {
    success()
    renderForm()
    startPosition()
    fillPosition()
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    choose("Tipo de taxa", "INDEXED")
    continueFlow()
    await waitFor(() =>
      expect(screen.getByText(/Informe índice e percentual/)).toBeTruthy()
    )
    expect(state.open).not.toHaveBeenCalled()
  })
  it("rejects reversed fixed-income dates", async () => {
    success()
    renderForm()
    startPosition()
    fillPosition()
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    fill("Data de emissão", "2028-01-01")
    fill("Data de vencimento", "2027-01-01")
    continueFlow()
    await waitFor(() =>
      expect(screen.getByText(/ordem cronológica/)).toBeTruthy()
    )
    expect(state.open).not.toHaveBeenCalled()
  })
  it("buys through the atomic purchase path", async () => {
    success()
    renderForm()
    await reachReview("BUY")
    await submitInvestment()
    await waitFor(() =>
      expect(state.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PURCHASE",
          capitalMinor: "10000",
          funding: { mode: "INTERNAL_CASH" },
        })
      )
    )
  })
  it("renders the read-only purchase preview returned by the service", async () => {
    success()
    renderForm()
    await reachReview("BUY")
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "PURCHASE",
          type: "PURCHASE",
          capitalMinor: "10000",
          funding: { mode: "INTERNAL_CASH" },
        })
      )
    )
    await waitFor(() =>
      expect(screen.getAllByText(/R\$\s*123,45/).length).toBeGreaterThan(0)
    )
    expect(screen.getByText(/R\$\s*876,55/)).toBeTruthy()
  })
  it("previews known cost plus real cash without substituting valuation", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        bookCostDeltaMinor: "10000",
        netCashFlowMinor: "0",
        postings: [],
        categories: {},
        openingBalanceMinor: "10500",
        projectedCashMinor: "500",
        warnings: [],
      },
    })
    renderForm()
    reachAccounting()
    choose("Situação atual", "NOT_RECORDED")
    fill("Caixa real que já existe na carteira", "5,00")
    continueFlow()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "ALLOCATION",
          bookCostMinor: "10000",
          proposedOpeningBalanceMinor: "10500",
        })
      )
    )
    expect(state.preview.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      "valuationMinor"
    )
    await waitFor(() =>
      expect(
        screen.getByText("Saldo inicial a registrar").parentElement?.textContent
      ).toMatch(/R\$\s*105,00/)
    )
    expect(screen.queryByLabelText("Valor atual estimado")).toBeNull()
  })
  it("uses an external account only after explicit funding mode selection", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        bookCostDeltaMinor: "10000",
        netCashFlowMinor: "-10000",
        postings: [
          { accountId: "bank-1", amountMinor: "-10000" },
          { accountId: "wallet-1", amountMinor: "10000" },
        ],
        categories: {},
        projectedCashMinor: "100000",
        warnings: [],
      },
    })
    renderForm()
    reachAccounting("BUY")
    choose("Origem do dinheiro", "EXTERNAL_ACCOUNT")
    await waitFor(() =>
      expect(screen.getByLabelText("Conta de origem")).toHaveProperty(
        "value",
        "bank-1"
      )
    )
    continueFlow()
    await waitFor(() =>
      expect(state.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "PURCHASE",
          funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
        })
      )
    )
    await waitFor(() =>
      expect(screen.getByText("Banco").parentElement?.textContent).toMatch(
        /-R\$\s*100,00/
      )
    )
    expect(
      screen
        .getAllByText("Carteira")
        .find((element) => element.tagName === "SPAN")?.parentElement
        ?.textContent
    ).toMatch(/R\$\s*100,00/)
    await submitInvestment()
    await waitFor(() =>
      expect(state.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
        })
      )
    )
  })
  it("shows a valid negative-cash preview without disabling confirmation", async () => {
    success()
    state.preview.mockResolvedValue({
      ok: true,
      value: {
        bookCostDeltaMinor: "10000",
        netCashFlowMinor: "0",
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
    await reachReview()
    await waitFor(() =>
      expect(screen.getByText(/ficará negativo/i)).toBeTruthy()
    )
    expect(
      screen.getByRole("button", { name: "Confirmar investimento" })
    ).not.toHaveProperty("disabled", true)
  })
  it("blocks a second submission while the opening is pending", async () => {
    success()
    let complete: ((value: unknown) => void) | undefined
    state.open.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          complete = resolve
        })
    )
    renderForm()
    await reachReview()
    const save = screen.getByRole("button", {
      name: "Confirmar investimento",
    })
    await waitFor(() => expect(save).not.toHaveProperty("disabled", true))
    fireEvent.click(save)
    await waitFor(() => expect(save).toHaveProperty("disabled", true))
    fireEvent.click(save)
    expect(state.open).toHaveBeenCalledTimes(1)
    complete?.({
      ok: true,
      value: {
        requestId: "open",
        positionId: "position-1",
        journalEntryIds: [],
        warnings: [],
      },
    })
    await waitFor(() => expect(save).toHaveProperty("disabled", false))
  })
  it("preserves fields and requestId on retry", async () => {
    success()
    state.open
      .mockResolvedValueOnce({ ok: false, error: { code: "TEMPORARY" } })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          requestId: "open",
          positionId: "position-1",
          journalEntryIds: [],
          warnings: [],
        },
      })
    renderForm()
    await reachReview()
    await submitInvestment()
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(1))
    expect(screen.getByText("100,00")).toBeTruthy()
    await submitInvestment()
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2))
    expect(state.open.mock.calls[1][0].requestId).toBe(
      state.open.mock.calls[0][0].requestId
    )
  })
  it("calls success with the created position", async () => {
    success()
    const onSuccess = renderForm()
    await reachReview()
    await submitInvestment()
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ positionId: "position-1" })
      )
    )
  })
})
