import type { InvestmentPositionView } from "@workspace/application"

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function positionTerms(position: InvestmentPositionView) {
  const data = position.fixedIncomeTerms
  if (data === undefined) return []
  return [
    data.rateKind && {
      label: "Rentabilidade",
      value:
        data.rateKind === "PREFIXED"
          ? "Prefixada"
          : data.rateKind === "INDEXED"
            ? "Indexada"
            : "Híbrida",
    },
    data.index && { label: "Índice", value: data.index },
    data.annualRate && { label: "Taxa anual", value: `${data.annualRate}%` },
    data.indexPercentage && {
      label: "Percentual do índice",
      value: `${data.indexPercentage}%`,
    },
    data.annualSpreadRate && {
      label: "Spread anual",
      value: `${data.annualSpreadRate}%`,
    },
    data.issueDate && {
      label: "Emissão",
      value: formatDate(data.issueDate),
    },
    data.gracePeriodDate && {
      label: "Carência",
      value: formatDate(data.gracePeriodDate),
    },
    data.maturityDate && {
      label: "Vencimento",
      value: formatDate(data.maturityDate),
    },
  ].filter((term): term is { label: string; value: string } => Boolean(term))
}
