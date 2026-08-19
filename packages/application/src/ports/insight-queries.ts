import type { BookId, LedgerAccountId, LocalDate } from "@workspace/domain"
import type { YearMonth } from "./querying-types.js"

export interface MonthlyCashFlowItem {
  readonly month: string
  readonly incomeMinor: string
  readonly expenseMinor: string
  readonly netMinor: string
  readonly currency: string
}

export interface CategorySpendingItem {
  readonly categoryId: string
  readonly categoryName: string
  readonly amountMinor: string
  readonly percentageBasisPoints: number
  readonly transactionCount: number
  readonly archived: boolean
}

export interface NetWorthView {
  readonly assetMinor: string
  readonly liabilityMinor: string
  readonly netWorthMinor: string
  readonly currency: string
  readonly asOf: string | null
}

export interface GetMonthlyCashFlowInput {
  readonly bookId: BookId
  readonly fromMonth: YearMonth
  readonly toMonth: YearMonth
}

export interface GetCategorySpendingInput {
  readonly bookId: BookId
  readonly from: LocalDate
  readonly to: LocalDate
  readonly categoryId?: LedgerAccountId
}

export interface GetNetWorthInput {
  readonly bookId: BookId
  readonly asOf?: LocalDate
}

export interface InsightQueries {
  getMonthlyCashFlow(
    input: GetMonthlyCashFlowInput
  ): Promise<readonly MonthlyCashFlowItem[]>
  getCategorySpending(
    input: GetCategorySpendingInput
  ): Promise<readonly CategorySpendingItem[]>
  getNetWorth(input: GetNetWorthInput): Promise<NetWorthView>
}
