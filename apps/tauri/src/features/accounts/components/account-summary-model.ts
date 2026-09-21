import type { InvestmentPortfolioSummary } from "@workspace/application"

export type AccountSummaryCard = {
  readonly label: string
  readonly valueMinor: string
  readonly description: string
  readonly kind: "NET_WORTH" | "AVAILABLE" | "OTHER_ASSETS" | "ARCHIVED_DAILY"
}

export type AccountSummary = {
  readonly currency: string
  readonly cards: readonly AccountSummaryCard[]
  readonly hasOtherAssets: boolean
}

export function summarizeAccounts(
  summary: InvestmentPortfolioSummary
): AccountSummary {
  const cards: AccountSummaryCard[] = [
    {
      label: "Patrimônio contábil",
      valueMinor: summary.bookNetWorthMinor,
      description: "Ativos menos passivos registrados no livro.",
      kind: "NET_WORTH",
    },
    {
      label: "Dinheiro disponível",
      valueMinor: summary.availableMinor,
      description: "Somente contas diárias ativas.",
      kind: "AVAILABLE",
    },
    {
      label: "Outros ativos",
      valueMinor: summary.otherAssetsMinor,
      description: "Fora do dinheiro disponível.",
      kind: "OTHER_ASSETS",
    },
  ]

  if (summary.archivedDailyAccountBalanceMinor !== "0") {
    cards.push({
      label: "Saldo fora do disponível",
      valueMinor: summary.archivedDailyAccountBalanceMinor,
      description: "Contas diárias arquivadas continuam no patrimônio.",
      kind: "ARCHIVED_DAILY",
    })
  }

  return {
    currency: summary.currency,
    cards,
    hasOtherAssets: summary.otherAssetsMinor !== "0",
  }
}
