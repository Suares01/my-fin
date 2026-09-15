import type { InvestmentWarning } from "./investment-commands.js"
import type { QueryPage } from "./query-inputs.js"

export interface InvestmentPortfolioSummary {
  readonly bookId: string
  readonly currency: string
  readonly asOf: string
  readonly availableMinor: string
  readonly otherAssetsMinor: string
  readonly archivedDailyAccountBalanceMinor: string
  readonly bookNetWorthMinor: string
  readonly marketNetWorthMinor: string
  readonly investmentLedgerMinor: string
  readonly positionCostMinor: string
  readonly investmentCashMinor: string
  readonly investmentMarketValueMinor: string
  readonly unrealizedResultMinor: string
  readonly openPositionCount: number
  readonly valuedPositionCount: number
  readonly valuationDateRange: {
    readonly oldest: string
    readonly newest: string
  } | null
  readonly warnings: readonly InvestmentWarning[]
}
export interface GetInvestmentPortfolioSummaryInput {
  readonly bookId: string
  readonly currency: string
  readonly asOf: string
}
export interface InvestmentPortfolioSummaryQueries {
  getPortfolioSummary(
    input: GetInvestmentPortfolioSummaryInput
  ): Promise<InvestmentPortfolioSummary>
}
export interface PositionValuationView {
  readonly basis: "VALUATION" | "BOOK_COST" | "CLOSED"
  readonly currentValueMinor: string
  readonly valuationId?: string
  readonly valuedAt?: string
  readonly netValueMinor?: string
  readonly withdrawableValueMinor?: string
}
export interface InvestmentPositionView {
  readonly id: string
  readonly investmentAccountId: string
  readonly instrumentId: string
  readonly instrumentName: string
  readonly assetClass: string
  readonly label?: string
  readonly quantity?: string
  readonly bookCostMinor: string
  readonly currency: string
  readonly status: "OPEN" | "CLOSED"
  readonly allocationRevision: number
  readonly valuation: PositionValuationView
}
export interface InvestmentAccountView {
  readonly id: string
  readonly name: string
  readonly currency: string
  readonly status: "ACTIVE" | "ARCHIVED"
  readonly institutionName?: string
  readonly displayReference?: string
  readonly defaultSettlementAccountId?: string
  readonly ledgerBalanceMinor: string
  readonly positionCostMinor: string
  readonly cashMinor: string
  readonly marketValueMinor: string
  readonly unrealizedResultMinor: string
}
export interface InvestmentAccountDetailView extends InvestmentAccountView {
  readonly positionCount: number
  readonly openPositionCount: number
  readonly warnings: readonly InvestmentWarning[]
}
export interface InvestmentAccountQueryInput {
  readonly bookId: string
  readonly currency: string
  readonly asOf: string
}
export interface InvestmentAccountQueries {
  listInvestmentAccounts(
    input: InvestmentAccountQueryInput
  ): Promise<readonly InvestmentAccountView[]>
  getInvestmentAccountDetail(
    input: InvestmentAccountQueryInput & { readonly accountId: string }
  ): Promise<InvestmentAccountDetailView | null>
}
export interface InvestmentOperationHistoryItem {
  readonly id: string
  readonly type: string
  readonly occurredOn: string
  readonly sequence: string
  readonly grossAmountMinor: string
  readonly netCashFlowMinor: string
}
export interface InvestmentValuationHistoryItem {
  readonly id: string
  readonly valuedAt: string
  readonly recordSequence: string
  readonly grossValueMinor: string
  readonly allocationRevision: number
}
export interface ListInvestmentPositionsQuery {
  readonly bookId: string
  readonly accountId?: string
  readonly assetClass?: string
  readonly status?: "OPEN" | "CLOSED"
  readonly search?: string
  readonly limit: number
  readonly cursor?: string
}
export interface ListInvestmentOperationsQuery {
  readonly bookId: string
  readonly positionId: string
  readonly limit: number
  readonly cursor?: string
}
export interface ListInvestmentValuationsQuery {
  readonly bookId: string
  readonly positionId: string
  readonly limit: number
  readonly cursor?: string
}
export interface InvestmentQueries {
  listPositions(
    query: ListInvestmentPositionsQuery
  ): Promise<QueryPage<InvestmentPositionView>>
  listOperations(
    query: ListInvestmentOperationsQuery
  ): Promise<QueryPage<InvestmentOperationHistoryItem>>
  listValuations(
    query: ListInvestmentValuationsQuery
  ): Promise<QueryPage<InvestmentValuationHistoryItem>>
}
