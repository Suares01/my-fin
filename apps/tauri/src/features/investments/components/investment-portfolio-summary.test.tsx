/* @vitest-environment jsdom */
import type { InvestmentPortfolioSummary as Portfolio } from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentPortfolioSummary } from "./investment-portfolio-summary"

const base: Portfolio = {
  bookId: "book-1",
  currency: "BRL",
  asOf: "2026-09-27",
  availableMinor: "120000",
  otherAssetsMinor: "30000",
  archivedDailyAccountBalanceMinor: "5000",
  bookNetWorthMinor: "200000",
  marketNetWorthMinor: "220000",
  investmentLedgerMinor: "100000",
  positionCostMinor: "90000",
  investmentCashMinor: "10000",
  investmentMarketValueMinor: "110000",
  unrealizedResultMinor: "20000",
  openPositionCount: 2,
  valuedPositionCount: 1,
  valuationDateRange: { oldest: "2026-09-20", newest: "2026-09-25" },
  warnings: [],
}
const show = (
  summary?: Portfolio,
  props: {
    isPending?: boolean
    isError?: boolean
    onRetry?: () => void
    onCreateAccount?: () => void
    accountCount?: number
  } = {}
) =>
  render(
    <InvestmentPortfolioSummary
      summary={summary ?? (props.isPending || props.isError ? undefined : base)}
      accountCount={props.accountCount ?? 0}
      isPending={props.isPending ?? false}
      isError={props.isError ?? false}
      onRetry={props.onRetry ?? vi.fn()}
      onCreateAccount={props.onCreateAccount}
    />
  )

afterEach(cleanup)

describe("InvestmentPortfolioSummary", () => {
  it("shows available money in book currency", () => {
    show()
    expect(
      within(screen.getByTestId("available-card")).getByText(/R\$\s*1\.200,00/)
    ).toBeTruthy()
    expect(screen.getByText("Moeda-base: BRL")).toBeTruthy()
  })
  it("shows book net worth separately from available money", () => {
    show()
    expect(
      within(screen.getByTestId("book-net-worth-card")).getByText(
        /R\$\s*2\.000,00/
      )
    ).toBeTruthy()
  })
  it("shows the assessed net worth supplied by the summary", () => {
    show()
    expect(
      within(screen.getByTestId("market-net-worth-card")).getByText(
        /R\$\s*2\.200,00/
      )
    ).toBeTruthy()
  })
  it("shows one book reference date for all totals", () => {
    show()
    expect(screen.getByText("Data de referência: 27/09/2026")).toBeTruthy()
  })
  it("shows valuation coverage and distinct oldest/newest dates", () => {
    show()
    expect(
      screen.getByText(/1 de 2 posições abertas com avaliação atual/)
    ).toBeTruthy()
    expect(screen.getByText(/20\/09\/2026 a 25\/09\/2026/)).toBeTruthy()
    expect(
      screen.getByText(/não representa uma cotação sincronizada/)
    ).toBeTruthy()
  })
  it("labels missing valuation as cost fallback", () => {
    show({ ...base, valuedPositionCount: 0, valuationDateRange: null })
    expect(screen.getByText(/Sem avaliação atual; usando custo/)).toBeTruthy()
    expect(screen.getByText(/0 de 2 posições abertas/)).toBeTruthy()
  })
  it("keeps closed-position history out of open valuation coverage", () => {
    show({
      ...base,
      investmentLedgerMinor: "50000",
      investmentCashMinor: "50000",
      positionCostMinor: "0",
      investmentMarketValueMinor: "0",
      openPositionCount: 0,
      valuedPositionCount: 0,
      valuationDateRange: null,
    })
    expect(screen.getByText(/0 de 0 posições abertas/)).toBeTruthy()
    expect(
      screen.queryByText(/Nenhuma carteira ou posição cadastrada/)
    ).toBeNull()
    expect(screen.getByText(/Caixa das carteiras: R\$\s*500,00/)).toBeTruthy()
  })
  it("does not fabricate unknown net and withdrawable valuations", () => {
    show()
    expect(
      screen.getByText(/Valor líquido e resgatável: desconhecidos/)
    ).toBeTruthy()
  })
  it("keeps other assets and archived daily balances outside available money", () => {
    show()
    expect(screen.getByText(/Outros ativos: R\$\s*300,00/)).toBeTruthy()
    expect(
      screen.getByText(/Saldos diários arquivados: R\$\s*50,00/)
    ).toBeTruthy()
  })
  it("shows an empty state with book currency and account action", () => {
    const onCreateAccount = vi.fn()
    show(
      {
        ...base,
        availableMinor: "0",
        otherAssetsMinor: "0",
        archivedDailyAccountBalanceMinor: "0",
        bookNetWorthMinor: "0",
        marketNetWorthMinor: "0",
        investmentLedgerMinor: "0",
        positionCostMinor: "0",
        investmentCashMinor: "0",
        investmentMarketValueMinor: "0",
        unrealizedResultMinor: "0",
        openPositionCount: 0,
        valuedPositionCount: 0,
        valuationDateRange: null,
      },
      { onCreateAccount }
    )
    expect(
      screen.getByText(/Nenhuma carteira ou posição cadastrada/)
    ).toBeTruthy()
    expect(screen.getByText("Moeda-base: BRL")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar carteira" }))
    expect(onCreateAccount).toHaveBeenCalledTimes(1)
  })
  it("does not call a funded empty wallet an absent wallet", () => {
    show(
      {
        ...base,
        investmentLedgerMinor: "0",
        openPositionCount: 0,
      },
      { accountCount: 1 }
    )
    expect(
      screen.queryByText(/Nenhuma carteira ou posição cadastrada/)
    ).toBeNull()
  })
  it("shows loading instead of a fabricated zero", () => {
    show(undefined, { isPending: true })
    expect(screen.getByLabelText("Carregando resumo patrimonial")).toBeTruthy()
    expect(screen.queryByText(/R\$\s*0,00/)).toBeNull()
  })
  it("shows error and retry without fabricating a zero", () => {
    const onRetry = vi.fn()
    show(undefined, { isError: true, onRetry })
    expect(
      screen.getByText("Não foi possível carregar o resumo patrimonial")
    ).toBeTruthy()
    expect(screen.queryByText(/R\$\s*0,00/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it("retains stale values and marks them after refresh error", () => {
    show(base, { isError: true })
    expect(
      screen.getByText(/Dados anteriores; atualização falhou/)
    ).toBeTruthy()
    expect(
      within(screen.getByTestId("market-net-worth-card")).getByText(
        /R\$\s*2\.200,00/
      )
    ).toBeTruthy()
  })
  it("preserves negative cash and assessed total with an inconsistency warning", () => {
    show({
      ...base,
      investmentCashMinor: "-10000",
      marketNetWorthMinor: "210000",
      warnings: [
        {
          code: "INVESTMENT_CASH_NEGATIVE",
          investmentAccountId: "wallet-1",
          cashMinor: "-10000",
          currency: "BRL",
          asOf: "2026-09-27",
        },
      ],
    })
    expect(
      screen.getByText(
        /Saldo da carteira menor que o custo alocado; revise os registros/
      )
    ).toBeTruthy()
    expect(
      screen.getByText(
        /Valores calculados com inconsistências; revise saldos e aportes/
      )
    ).toBeTruthy()
    expect(screen.getByText(/Caixa das carteiras: -R\$\s*100,00/)).toBeTruthy()
    expect(
      within(screen.getByTestId("market-net-worth-card")).getByText(
        /R\$\s*2\.100,00/
      )
    ).toBeTruthy()
  })
  it("removes the inconsistency warning after cash becomes nonnegative", () => {
    const { rerender } = show({
      ...base,
      investmentCashMinor: "-100",
      warnings: [
        {
          code: "INVESTMENT_CASH_NEGATIVE",
          investmentAccountId: "wallet-1",
          cashMinor: "-100",
          currency: "BRL",
          asOf: "2026-09-27",
        },
      ],
    })
    expect(
      screen.getByText(/Valores calculados com inconsistências/)
    ).toBeTruthy()
    rerender(
      <InvestmentPortfolioSummary
        summary={base}
        accountCount={1}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />
    )
    expect(
      screen.queryByText(/Valores calculados com inconsistências/)
    ).toBeNull()
  })
  it("uses the supplied book currency even when all amounts are zero", () => {
    show({
      ...base,
      currency: "USD",
      availableMinor: "0",
      bookNetWorthMinor: "0",
      marketNetWorthMinor: "0",
    })
    expect(screen.getByText("Moeda-base: USD")).toBeTruthy()
    expect(
      within(screen.getByTestId("available-card")).getByText(/US\$\s*0,00/)
    ).toBeTruthy()
  })
})
