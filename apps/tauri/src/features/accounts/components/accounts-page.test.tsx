/* @vitest-environment jsdom */

import type {
  AccountBalanceItemView,
  InvestmentPortfolioSummary,
} from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AccountsPage } from "./accounts-page"
import type { FinancialAccountBalance } from "./account-card"
import { filterAccounts } from "./account-list-model"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as const,
  mutateAsync: vi.fn(),
  configureAsync: vi.fn(),
}))

const hooks = vi.hoisted(() => ({
  useAccountBalances: vi.fn(),
  useCreateAccount: vi.fn(() => ({
    mutateAsync: state.mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  })),
  useConfigureAccount: vi.fn(() => ({
    mutateAsync: state.configureAsync,
    isPending: false,
  })),
}))

const investments = vi.hoisted(() => ({
  useInvestmentPortfolio: vi.fn(),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useAccountBalances: hooks.useAccountBalances,
  useCreateAccount: hooks.useCreateAccount,
  useConfigureAccount: hooks.useConfigureAccount,
}))

vi.mock("../../investments/hooks", () => ({
  useInvestmentPortfolio: investments.useInvestmentPortfolio,
}))

const portfolio: InvestmentPortfolioSummary = {
  bookId: "book-1",
  currency: "BRL",
  asOf: "2026-09-21",
  availableMinor: "120000",
  otherAssetsMinor: "0",
  archivedDailyAccountBalanceMinor: "0",
  bookNetWorthMinor: "90000",
  marketNetWorthMinor: "90000",
  investmentLedgerMinor: "0",
  positionCostMinor: "0",
  investmentCashMinor: "0",
  investmentMarketValueMinor: "0",
  unrealizedResultMinor: "0",
  openPositionCount: 0,
  valuedPositionCount: 0,
  valuationDateRange: null,
  warnings: [],
}

const accounts: readonly FinancialAccountBalance[] = [
  {
    accountId: "asset-1",
    accountName: "Carteira",
    accountKind: "ASSET",
    rawBalanceMinor: "120000",
    displayBalanceMinor: "120000",
    amountMinor: "120000",
    currency: "BRL",
    asOf: null,
    archived: false,
  },
  {
    accountId: "liability-1",
    accountName: "Cartão",
    accountKind: "LIABILITY",
    rawBalanceMinor: "30000",
    displayBalanceMinor: "30000",
    amountMinor: "30000",
    currency: "BRL",
    asOf: null,
    archived: false,
  },
]

describe("AccountsPage", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function renderWithQueries(input?: {
    readonly accounts?: readonly FinancialAccountBalance[]
    readonly portfolio?: InvestmentPortfolioSummary
    readonly portfolioPending?: boolean
    readonly portfolioError?: boolean
  }) {
    hooks.useAccountBalances.mockReturnValue({
      isPending: false,
      isError: false,
      data: input?.accounts ?? accounts,
      refetch: vi.fn(),
    })
    investments.useInvestmentPortfolio.mockReturnValue({
      isPending: input?.portfolioPending ?? false,
      isError: input?.portfolioError ?? false,
      data: input?.portfolio ?? portfolio,
      refetch: vi.fn(),
    })
    return render(<AccountsPage />)
  }

  it("uses the portfolio query for the accounting net worth", () => {
    renderWithQueries()

    expect(screen.getByText("Patrimônio contábil")).toBeTruthy()
    expect(
      screen.getByText((_, element) => element?.textContent === "R$ 900,00")
    ).toBeTruthy()
    expect(screen.queryByText("Saldo consolidado")).toBeNull()
  })

  it("keeps the book base currency for an empty non-BRL book", () => {
    renderWithQueries({
      accounts: [],
      portfolio: { ...portfolio, currency: "USD", bookNetWorthMinor: "0" },
    })

    expect(screen.getByText("Moeda-base: USD")).toBeTruthy()
    expect(
      within(screen.getByLabelText("Resumo contábil")).getAllByText(
        (_, element) => element?.textContent === "US$ 0,00"
      )
    ).toHaveLength(2)
  })

  it("shows available money from the portfolio query", () => {
    renderWithQueries({
      portfolio: { ...portfolio, availableMinor: "30000" },
    })

    expect(screen.getByText("Dinheiro disponível")).toBeTruthy()
    expect(
      within(screen.getByLabelText("Resumo contábil")).getByText(
        (_, element) => element?.textContent === "R$ 300,00"
      )
    ).toBeTruthy()
  })

  it("keeps other assets outside available money", () => {
    renderWithQueries({
      portfolio: { ...portfolio, otherAssetsMinor: "4500" },
    })

    expect(screen.getByText("Outros ativos")).toBeTruthy()
    expect(
      screen.getByText((_, element) => element?.textContent === "R$ 45,00")
    ).toBeTruthy()
    expect(
      screen.getByText("Outros ativos não são dinheiro disponível")
    ).toBeTruthy()
  })

  it("shows archived daily-account money outside available money", () => {
    renderWithQueries({
      portfolio: { ...portfolio, archivedDailyAccountBalanceMinor: "8000" },
    })

    expect(screen.getByText("Saldo fora do disponível")).toBeTruthy()
    expect(
      screen.getByText((_, element) => element?.textContent === "R$ 80,00")
    ).toBeTruthy()
  })

  it("renders a loading state instead of a fictitious zero summary", () => {
    renderWithQueries({ portfolioPending: true, portfolio: undefined })

    expect(screen.getByLabelText("Carregando resumo contábil")).toBeTruthy()
    expect(screen.queryByText("Patrimônio contábil")).toBeNull()
  })

  it("keeps an actionable retry when the portfolio query fails", () => {
    const refetch = vi.fn()
    hooks.useAccountBalances.mockReturnValue({
      isPending: false,
      isError: false,
      data: accounts,
      refetch: vi.fn(),
    })
    investments.useInvestmentPortfolio.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      refetch,
    })
    render(<AccountsPage />)

    expect(
      screen.getByText("Não foi possível carregar o resumo contábil")
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar carregar resumo novamente" })
    )
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("does not change book totals when the account list filter changes", () => {
    renderWithQueries()

    fireEvent.click(screen.getByRole("button", { name: "Passivos" }))

    expect(screen.getByText("Patrimônio contábil")).toBeTruthy()
    expect(
      within(screen.getByLabelText("Resumo contábil")).getByText(
        (_, element) => element?.textContent === "R$ 900,00"
      )
    ).toBeTruthy()
  })

  it("filters financial accounts by type", () => {
    expect(filterAccounts(accounts, "ASSET")).toEqual([accounts[0]])
    expect(filterAccounts(accounts, "LIABILITY")).toEqual([accounts[1]])
    expect(filterAccounts(accounts, "ALL")).toEqual(accounts)

    const category: AccountBalanceItemView = {
      ...accounts[0],
      accountId: "income-1",
      accountKind: "INCOME",
    }
    expect(filterAccounts([...accounts, category], "ALL")).toEqual(accounts)
  })

  it("keeps the creation CTA available for an empty filter and opens its drawer", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    hooks.useAccountBalances.mockReturnValue({
      isPending: false,
      isError: false,
      data: [accounts[0]],
      refetch: vi.fn(),
    })
    investments.useInvestmentPortfolio.mockReturnValue({
      isPending: false,
      isError: false,
      data: portfolio,
      refetch: vi.fn(),
    })

    render(<AccountsPage />)

    fireEvent.click(screen.getByRole("button", { name: "Ativos" }))
    expect(screen.getByText("Carteira")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Passivos" }))
    expect(
      screen.getByText("Nenhuma conta de passivo foi encontrada.")
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Adicionar conta/i }))
    expect(screen.getByRole("dialog").textContent).toContain("Adicionar conta")
    expect(screen.getByLabelText("Nome da conta")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Reserva" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(screen.getByRole("button", { name: /Adicionar conta/i }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(screen.getByRole("button", { name: /Adicionar conta/i }))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("opens the account classification drawer from a card", () => {
    hooks.useAccountBalances.mockReturnValue({
      isPending: false,
      isError: false,
      data: [accounts[0]],
      refetch: vi.fn(),
    })
    investments.useInvestmentPortfolio.mockReturnValue({
      isPending: false,
      isError: false,
      data: portfolio,
      refetch: vi.fn(),
    })

    render(<AccountsPage />)

    fireEvent.click(
      screen.getByRole("button", { name: "Classificar Carteira" })
    )

    expect(screen.getByRole("dialog").textContent).toContain(
      "Classificar conta"
    )
    expect(
      screen.getByRole("button", { name: "Salvar classificação" })
    ).toBeTruthy()
  })
})
