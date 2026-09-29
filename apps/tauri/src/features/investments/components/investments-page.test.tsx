/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type {
  InvestmentAccountView,
  InvestmentInstrumentView,
  InvestmentPositionView,
} from "@workspace/application"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { FinancialAccountBalance } from "../../accounts/components/account-card"
import { InvestmentsPage } from "./investments-page"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { status: "ACTIVE"; bookId: string }
    | { status: "UNRESOLVED" },
  summaryQuery: undefined as unknown,
  accountsQuery: undefined as unknown,
  instrumentsQuery: undefined as unknown,
  balancesQuery: undefined as unknown,
  summaryProps: undefined as unknown,
  accountProps: undefined as unknown,
  tableProps: undefined as unknown,
  detailProps: undefined as unknown,
  form: undefined as unknown,
  invalidated: [] as string[],
  archive: vi.fn(),
  reactivate: vi.fn(),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))
vi.mock("../hooks", () => ({
  useInvestmentPortfolio: () => state.summaryQuery,
  useInvestmentAccounts: () => state.accountsQuery,
  useInvestmentInstruments: () => state.instrumentsQuery,
  invalidateInvestmentQueries: async (_client: unknown, bookId: string) => {
    state.invalidated.push(bookId)
  },
}))
vi.mock("../../accounts/hooks", () => ({
  useAccountBalances: () => state.balancesQuery,
  useArchiveAccount: () => ({ mutateAsync: state.archive }),
  useReactivateAccount: () => ({ mutateAsync: state.reactivate }),
}))
vi.mock("@workspace/ui/components/drawer", () => ({
  Drawer: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) =>
    open ? (
      <div role="dialog">
        {children}
        <button onClick={() => onOpenChange(false)}>Fechar drawer</button>
      </div>
    ) : null,
  DrawerBackdrop: () => null,
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
  DrawerDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}))
vi.mock("./investment-portfolio-summary", () => ({
  InvestmentPortfolioSummary: (props: {
    summary?: { bookNetWorthMinor: string }
    isPending: boolean
    isError: boolean
    onRetry: () => void
    onCreateAccount: () => void
  }) => {
    state.summaryProps = props
    return (
      <div data-testid="summary">
        {props.summary
          ? props.summary.bookNetWorthMinor
          : props.isPending
            ? "Carregando resumo"
            : "Erro no resumo"}
        <button onClick={props.onRetry}>Recarregar resumo</button>
        <button onClick={props.onCreateAccount}>Criar do resumo</button>
      </div>
    )
  },
}))
vi.mock("./investment-account-list", () => ({
  InvestmentAccountList: (props: {
    accounts?: readonly InvestmentAccountView[]
    selectedAccountId?: string
    isPending: boolean
    isError: boolean
    actionError?: string | null
    actionPendingId?: string
    onRetry: () => void
    onCreate: () => void
    onSelect: (id: string) => void
    onConfigure: (account: InvestmentAccountView) => void
    onArchive: (account: InvestmentAccountView) => void
    onReactivate: (account: InvestmentAccountView) => void
  }) => {
    state.accountProps = props
    const account = props.accounts?.[0]
    return (
      <div data-testid="wallets">
        {props.accounts === undefined
          ? props.isPending
            ? "Carregando carteiras"
            : "Erro nas carteiras"
          : (account?.name ?? "Sem carteiras")}
        {props.actionError && <span>{props.actionError}</span>}
        <button onClick={props.onRetry}>Recarregar carteiras</button>
        <button onClick={props.onCreate}>Criar da lista</button>
        {account && (
          <>
            <button onClick={() => props.onSelect(account.id)}>
              Selecionar carteira
            </button>
            <button onClick={() => props.onConfigure(account)}>
              Configurar da lista
            </button>
            <button onClick={() => props.onArchive(account)}>
              Arquivar da lista
            </button>
            <button onClick={() => props.onReactivate(account)}>
              Reativar da lista
            </button>
          </>
        )}
      </div>
    )
  },
}))
vi.mock("./investment-position-table", () => ({
  InvestmentPositionTable: (props: {
    accounts: readonly InvestmentAccountView[]
    instruments: readonly InvestmentInstrumentView[]
    accountIdFilter?: string | null
    onAccountFilterChange: (id: string | null) => void
    onCreate: () => void
    onView: (position: InvestmentPositionView) => void
    onPurchase: (position: InvestmentPositionView) => void
    onSale: (position: InvestmentPositionView) => void
    onEvaluate: (position: InvestmentPositionView) => void
    onConfigure: (position: InvestmentPositionView) => void
  }) => {
    state.tableProps = props
    return (
      <div data-testid="positions">
        Filtro: {props.accountIdFilter ?? "todas"}
        <button onClick={() => props.onAccountFilterChange(null)}>
          Limpar carteira
        </button>
        <button onClick={props.onCreate}>Criar da tabela</button>
        <button onClick={() => props.onView(position)}>Ver posição</button>
        <button onClick={() => props.onPurchase(position)}>Comprar</button>
        <button onClick={() => props.onSale(position)}>Vender</button>
        <button onClick={() => props.onEvaluate(position)}>Avaliar</button>
        <button onClick={() => props.onConfigure(position)}>
          Editar posição
        </button>
      </div>
    )
  },
}))
vi.mock("./investment-position-detail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./investment-position-detail")>()),
  InvestmentPositionDetail: (props: {
    positionId: string
    onAction: (action: string, position: InvestmentPositionView) => void
    onCorrect: (
      operation: { id: string },
      position: InvestmentPositionView
    ) => void
  }) => {
    state.detailProps = props
    return (
      <div data-testid="detail">
        {props.positionId}
        {["income", "amortization", "fee", "tax"].map((action) => (
          <button key={action} onClick={() => props.onAction(action, position)}>
            {action}
          </button>
        ))}
        <button
          onClick={() => props.onCorrect({ id: "operation-1" }, position)}
        >
          Corrigir
        </button>
      </div>
    )
  },
}))

type FormProps = {
  readonly onSuccess?: () => void
  readonly onCancel?: () => void
  readonly [key: string]: unknown
}
function mockForm(name: string, props: FormProps) {
  state.form = { name, props }
  return (
    <div data-testid={`form-${name}`}>
      <button onClick={props.onSuccess}>Concluir formulário</button>
      <button onClick={props.onCancel}>Cancelar formulário</button>
    </div>
  )
}
vi.mock("../../accounts/components/account-form", () => ({
  AccountForm: (props: FormProps) => mockForm("wallet", props),
}))
vi.mock("../forms/investment-instrument-form", () => ({
  InvestmentInstrumentForm: (props: FormProps) => mockForm("instrument", props),
}))
vi.mock("../forms/open-investment-position-form", () => ({
  OpenInvestmentPositionForm: (props: FormProps) => mockForm("open", props),
}))
vi.mock("../forms/investment-purchase-form", () => ({
  InvestmentPurchaseForm: (props: FormProps) => mockForm("purchase", props),
}))
vi.mock("../forms/investment-sale-form", () => ({
  InvestmentSaleForm: (props: FormProps) => mockForm("sale", props),
}))
vi.mock("../forms/investment-income-form", () => ({
  InvestmentIncomeForm: (props: FormProps) => mockForm("income", props),
}))
vi.mock("../forms/investment-amortization-form", () => ({
  InvestmentAmortizationForm: (props: FormProps) =>
    mockForm("amortization", props),
}))
vi.mock("../forms/investment-expense-form", () => ({
  InvestmentExpenseForm: (props: FormProps) => mockForm("expense", props),
}))
vi.mock("../forms/investment-valuation-form", () => ({
  InvestmentValuationForm: (props: FormProps) => mockForm("valuation", props),
}))
vi.mock("../forms/investment-position-metadata-form", () => ({
  InvestmentPositionMetadataForm: (props: FormProps) =>
    mockForm("metadata", props),
}))
vi.mock("../forms/investment-correction-form", () => ({
  InvestmentCorrectionForm: (props: FormProps) => mockForm("correction", props),
}))

const wallet = {
  id: "wallet-1",
  name: "Corretora A",
  status: "ACTIVE",
  currency: "BRL",
  ledgerBalanceMinor: "0",
} as InvestmentAccountView
const instrument: InvestmentInstrumentView = {
  id: "instrument-1",
  name: "CDB A",
  type: "CDB",
  instrumentClass: "FIXED_INCOME",
  version: 3,
  currency: "BRL",
  status: "ACTIVE",
  identifiers: [],
}
const balance = {
  accountId: "wallet-1",
  accountName: "Corretora A",
  accountKind: "ASSET",
  version: 4,
  archived: false,
  financialAccount: { type: "INVESTMENT_ACCOUNT" },
} as FinancialAccountBalance
const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB A",
  assetClass: "FIXED_INCOME",
  bookCostMinor: "100000",
  currency: "BRL",
  status: "OPEN",
  fixedIncomeTerms: {
    maturityDate: "2028-01-01",
    annualRate: "11.5",
    rateKind: "PREFIXED",
  },
  version: 1,
  allocationRevision: 1,
  valuation: { basis: "BOOK_COST", currentValueMinor: "100000" },
}
const query = <T,>(data: T) => ({
  data,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
})
function show(
  props: React.ComponentProps<typeof InvestmentsPage> = {},
  queryClient = new QueryClient()
) {
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <InvestmentsPage {...props} />
    </QueryClientProvider>
  )
  return {
    ...rendered,
    queryClient,
    rerenderPage: (nextProps = props) =>
      rendered.rerender(
        <QueryClientProvider client={queryClient}>
          <InvestmentsPage {...nextProps} />
        </QueryClientProvider>
      ),
  }
}
function form() {
  return state.form as { name: string; props: FormProps }
}
function accounts() {
  return state.accountProps as {
    selectedAccountId?: string
    actionPendingId?: string
    actionError?: string
  }
}
function table() {
  return state.tableProps as {
    accountIdFilter?: string | null
    accounts: readonly InvestmentAccountView[]
  }
}

beforeEach(() => {
  state.session = { status: "ACTIVE", bookId: "book-1" }
  state.summaryQuery = query({ bookNetWorthMinor: "200000", currency: "BRL" })
  state.accountsQuery = query([wallet])
  state.instrumentsQuery = query([instrument])
  state.balancesQuery = query([balance])
  state.summaryProps = undefined
  state.accountProps = undefined
  state.tableProps = undefined
  state.detailProps = undefined
  state.form = undefined
  state.invalidated = []
  state.archive.mockReset().mockResolvedValue({ id: "wallet-1" })
  state.reactivate.mockReset().mockResolvedValue({ id: "wallet-1" })
})
afterEach(cleanup)

describe("InvestmentsPage", () => {
  it("requires a book before querying investment sections", () => {
    state.session = { status: "UNRESOLVED" }
    show()
    expect(
      screen.getByText("Selecione um livro para ver investimentos")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Escolher livro" }).getAttribute("href")
    ).toBe("/books")
    expect(state.summaryProps).toBeUndefined()
  })

  it("composes independent summary, wallets, instruments and positions", () => {
    show()
    expect(
      screen.getByRole("heading", { name: "Seus investimentos." })
    ).toBeTruthy()
    expect(screen.getByTestId("summary").textContent).toContain("200000")
    expect(screen.getByTestId("wallets").textContent).toContain("Corretora A")
    expect(screen.getByRole("heading", { name: "Instrumentos" })).toBeTruthy()
    expect(screen.getByTestId("positions")).toBeTruthy()
  })

  it("keeps summary loading separate from position data", () => {
    state.summaryQuery = { ...query(undefined), isPending: true }
    show()
    expect(screen.getByTestId("summary").textContent).toContain(
      "Carregando resumo"
    )
    expect(screen.getByTestId("positions")).toBeTruthy()
    expect(screen.queryByText("0")).toBeNull()
  })

  it("retries a failed portfolio without replacing loaded wallets", () => {
    state.summaryQuery = { ...query(undefined), isError: true }
    show()
    fireEvent.click(screen.getByRole("button", { name: "Recarregar resumo" }))
    expect(
      (state.summaryQuery as ReturnType<typeof query>).refetch
    ).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("wallets").textContent).toContain("Corretora A")
  })

  it("does not show a false empty position list while catalogs load", () => {
    state.accountsQuery = { ...query(undefined), isPending: true }
    show()
    expect(screen.getByLabelText("Carregando posições")).toBeTruthy()
    expect(state.tableProps).toBeUndefined()
  })

  it("keeps cached instruments visible with retry after refresh failure", () => {
    state.instrumentsQuery = { ...query([instrument]), isError: true }
    show()
    expect(screen.getByText("CDB A")).toBeTruthy()
    expect(
      screen.getByText("Dados anteriores; atualização dos instrumentos falhou")
    ).toBeTruthy()
    expect(screen.getByTestId("positions")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Recarregar instrumentos" })
    )
    expect(
      (state.instrumentsQuery as ReturnType<typeof query>).refetch
    ).toHaveBeenCalledTimes(1)
  })

  it("retries catalog errors instead of rendering positions with empty catalogs", () => {
    state.instrumentsQuery = { ...query(undefined), isError: true }
    show()
    expect(state.tableProps).toBeUndefined()
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tentar novamente" })[0]!
    )
    expect(
      (state.instrumentsQuery as ReturnType<typeof query>).refetch
    ).toHaveBeenCalled()
  })

  it("filters positions by a selected wallet without changing the portfolio total", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Selecionar carteira" }))
    expect(accounts().selectedAccountId).toBe("wallet-1")
    expect(table().accountIdFilter).toBe("wallet-1")
    expect(screen.getByTestId("summary").textContent).toContain("200000")
  })

  it("clears the selected wallet from the table filter", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Selecionar carteira" }))
    fireEvent.click(screen.getByRole("button", { name: "Limpar carteira" }))
    expect(table().accountIdFilter).toBeNull()
    expect(accounts().selectedAccountId).toBeUndefined()
  })

  it("opens the existing two-mode form from Novo investimento", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Novo investimento" }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByTestId("form-open")).toBeTruthy()
  })

  it("creates a wallet with its type locked to investment", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar carteira" }))
    expect(screen.getByTestId("form-wallet")).toBeTruthy()
    expect(form().props.lockedType).toBe("INVESTMENT_ACCOUNT")
  })

  it("edits a wallet using the persisted CAS version and settlement candidates", () => {
    state.balancesQuery = query([
      balance,
      {
        ...balance,
        accountId: "bank-1",
        accountName: "Banco",
        financialAccount: { type: "BANK_ACCOUNT" },
      },
    ])
    show()
    fireEvent.click(screen.getByRole("button", { name: "Configurar da lista" }))
    expect(form().props.mode).toBe("edit")
    expect(
      (form().props.initialAccount as FinancialAccountBalance).version
    ).toBe(4)
    expect(form().props.settlementAccounts).toEqual([
      { id: "bank-1", name: "Banco" },
    ])
  })

  it("explains other assets and opens classification without changing the existing account", () => {
    state.balancesQuery = query([
      balance,
      {
        ...balance,
        accountId: "other-1",
        accountName: "Reserva antiga",
        version: 7,
        financialAccount: { type: "OTHER_ASSET" },
      },
    ])
    show()

    expect(screen.getByText("Contas a classificar")).toBeTruthy()
    expect(screen.getByText(/fora do dinheiro disponível/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Classificar Reserva antiga como carteira",
      })
    )
    expect(
      screen.getByRole("heading", { name: "Classificar como carteira" })
    ).toBeTruthy()
    expect(form().name).toBe("wallet")
    expect(form().props.mode).toBe("edit")
    expect(form().props.lockedType).toBe("INVESTMENT_ACCOUNT")
    expect(form().props.initialAccount).toMatchObject({
      accountId: "other-1",
      version: 7,
      financialAccount: { type: "OTHER_ASSET" },
    })
  })

  it("does not classify an other asset without a persisted version", () => {
    state.balancesQuery = query([
      balance,
      {
        ...balance,
        accountId: "other-1",
        accountName: "Reserva antiga",
        version: undefined,
        financialAccount: { type: "OTHER_ASSET" },
      },
    ])
    show()

    expect(
      screen.getByText("Atualize as contas antes de classificar.")
    ).toBeTruthy()
    expect(
      screen
        .getByRole("button", {
          name: "Classificar Reserva antiga como carteira",
        })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("archives a wallet with book and expected version", async () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Arquivar da lista" }))
    await waitFor(() =>
      expect(state.archive).toHaveBeenCalledWith({
        bookId: "book-1",
        accountId: "wallet-1",
        expectedVersion: 4,
      })
    )
    expect(state.invalidated).toEqual(["book-1"])
  })

  it("reactivates a wallet with book and expected version", async () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Reativar da lista" }))
    await waitFor(() =>
      expect(state.reactivate).toHaveBeenCalledWith({
        bookId: "book-1",
        accountId: "wallet-1",
        expectedVersion: 4,
      })
    )
  })

  it("does not guess a missing account version", () => {
    state.balancesQuery = query([{ ...balance, version: undefined }])
    show()
    fireEvent.click(screen.getByRole("button", { name: "Arquivar da lista" }))
    expect(state.archive).not.toHaveBeenCalled()
    expect(
      screen.getByText("Atualize a carteira antes de alterar seu estado.")
    ).toBeTruthy()
  })

  it("shows a scoped error when wallet archival fails", async () => {
    state.archive.mockRejectedValue(new Error("offline"))
    show()
    fireEvent.click(screen.getByRole("button", { name: "Arquivar da lista" }))
    await waitFor(() =>
      expect(
        screen.getByText(
          "Não foi possível atualizar a carteira. Atualize os dados e tente novamente."
        )
      ).toBeTruthy()
    )
    expect(state.invalidated).toEqual([])
  })

  it("opens instrument creation and edit with persisted class/version", () => {
    show()
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar instrumento" })
    )
    expect(form().name).toBe("instrument")
    fireEvent.click(screen.getByRole("button", { name: "Fechar drawer" }))
    fireEvent.click(screen.getByRole("button", { name: "Configurar CDB A" }))
    expect(form().props.mode).toBe("edit")
    expect(form().props.initialInstrument).toMatchObject({
      bookId: "book-1",
      id: "instrument-1",
      version: 3,
      instrumentClass: "FIXED_INCOME",
    })
  })

  it("preserves known fixed-income terms in the label editor", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Editar posição" }))
    expect(form().name).toBe("metadata")
    expect(form().props.terms).toEqual(
      expect.arrayContaining([
        { label: "Taxa anual", value: "11.5%" },
        { label: "Vencimento", value: "01/01/2028" },
      ])
    )
  })

  it("opens and closes detail without loading a generic edit form", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Ver posição" }))
    expect(screen.getByTestId("detail").textContent).toContain("position-1")
    expect(screen.queryByTestId("form-metadata")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Fechar drawer" }))
    expect(screen.queryByTestId("detail")).toBeNull()
  })

  it("uses the route callback when a position is selected", () => {
    const navigate = vi.fn()
    show({ onNavigatePosition: navigate })
    fireEvent.click(screen.getByRole("button", { name: "Ver posição" }))
    expect(navigate).toHaveBeenCalledWith("position-1")
  })

  it("routes purchase, sale, valuation and metadata to specialized forms", () => {
    show()
    const cases = [
      ["Comprar", "purchase"],
      ["Vender", "sale"],
      ["Avaliar", "valuation"],
      ["Editar posição", "metadata"],
    ] as const
    for (const [button, expected] of cases) {
      fireEvent.click(screen.getByRole("button", { name: button }))
      expect(form().name).toBe(expected)
      expect(
        form().props.position ?? form().props.initialPosition
      ).toBeDefined()
      fireEvent.click(screen.getByRole("button", { name: "Fechar drawer" }))
    }
  })

  it("routes income, amortization, fee, tax and correction from detail", () => {
    show()
    const cases = [
      ["income", "income"],
      ["amortization", "amortization"],
      ["fee", "expense"],
      ["tax", "expense"],
      ["Corrigir", "correction"],
    ] as const
    for (const [button, expected] of cases) {
      fireEvent.click(screen.getByRole("button", { name: "Ver posição" }))
      fireEvent.click(screen.getByRole("button", { name: button }))
      expect(form().name).toBe(expected)
      if (button === "tax") expect(form().props.initialType).toBe("TAX")
      if (button === "Corrigir")
        expect(form().props.operation).toMatchObject({ id: "operation-1" })
      fireEvent.click(screen.getByRole("button", { name: "Fechar drawer" }))
    }
  })

  it("closes an action drawer and clears selected wallet on book change", () => {
    const page = show()
    fireEvent.click(screen.getByRole("button", { name: "Selecionar carteira" }))
    fireEvent.click(screen.getByRole("button", { name: "Novo investimento" }))
    state.session = { status: "ACTIVE", bookId: "book-2" }
    page.rerenderPage()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(table().accountIdFilter).toBeNull()
  })

  it("invalidates only the originating book after a delayed form success", async () => {
    const page = show()
    fireEvent.click(screen.getByRole("button", { name: "Novo investimento" }))
    const oldSuccess = form().props.onSuccess!
    state.session = { status: "ACTIVE", bookId: "book-2" }
    page.rerenderPage()
    await act(async () => oldSuccess())
    expect(state.invalidated).toEqual(["book-1"])
  })

  it("keeps a deep-linked position scoped and requests navigation reset on book change", () => {
    const navigate = vi.fn()
    const page = show({
      positionId: "position-1",
      onNavigatePosition: navigate,
    })
    expect(screen.getByTestId("detail")).toBeTruthy()
    state.session = { status: "ACTIVE", bookId: "book-2" }
    page.rerenderPage({
      positionId: "position-1",
      onNavigatePosition: navigate,
    })
    expect(navigate).toHaveBeenCalledWith(null)
  })
})
