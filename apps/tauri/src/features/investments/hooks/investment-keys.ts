export type InvestmentPositionFilters = {
  readonly accountId?: string
  readonly assetClass?: string
  readonly status?: "OPEN" | "CLOSED" | "ALL"
  readonly search?: string
}

export function normalizeInvestmentPositionFilters(
  filters: InvestmentPositionFilters
): InvestmentPositionFilters {
  const search = filters.search?.trim()
  return {
    ...(filters.accountId === undefined
      ? {}
      : { accountId: filters.accountId }),
    ...(filters.assetClass === undefined
      ? {}
      : { assetClass: filters.assetClass }),
    ...(filters.status === undefined ? {} : { status: filters.status }),
    ...(search === undefined || search.length === 0 ? {} : { search }),
  }
}

export const investmentKeys = {
  all: (bookId: string) => ["investments", bookId] as const,
  portfolio: (bookId: string, asOf: string) =>
    [...investmentKeys.all(bookId), "portfolio", asOf] as const,
  accounts: (bookId: string, asOf: string) =>
    [...investmentKeys.all(bookId), "accounts", asOf] as const,
  instruments: (bookId: string, status?: "ACTIVE" | "ARCHIVED") =>
    [...investmentKeys.all(bookId), "instruments", { status }] as const,
  positions: (bookId: string, filters: InvestmentPositionFilters) =>
    [...investmentKeys.all(bookId), "positions", filters] as const,
  operations: (bookId: string, positionId: string) =>
    [...investmentKeys.all(bookId), "operations", positionId] as const,
  valuations: (bookId: string, positionId: string) =>
    [...investmentKeys.all(bookId), "valuations", positionId] as const,
}
