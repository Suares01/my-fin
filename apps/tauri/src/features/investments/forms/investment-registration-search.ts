import type { InvestmentInstrumentView } from "@workspace/application"

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR")
}

export function filterInvestmentInstruments(
  instruments: readonly InvestmentInstrumentView[],
  search: string
): readonly InvestmentInstrumentView[] {
  const query = normalizeSearch(search)
  if (!query) return instruments
  return instruments.filter((instrument) =>
    [
      instrument.name,
      instrument.type,
      instrument.issuerName ?? "",
      ...instrument.identifiers.flatMap((identifier) => [
        identifier.value,
        identifier.market ?? "",
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(query)
  )
}
