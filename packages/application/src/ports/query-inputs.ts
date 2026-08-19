export interface QueryPage<T> {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}

export interface ListAccountBalancesQuery {
  readonly bookId: string
  readonly accountKinds?: readonly string[]
  readonly asOf?: string
  readonly includeArchived?: boolean
  readonly includeZeroBalance?: boolean
}

export interface ListAccountStatementQuery {
  readonly bookId: string
  readonly accountId: string
  readonly from?: string
  readonly to?: string
  readonly limit: number
  readonly cursor?: string
}

export interface ListJournalEntriesQuery {
  readonly bookId: string
  readonly from?: string
  readonly to?: string
  readonly accountIds?: readonly string[]
  readonly categoryIds?: readonly string[]
  readonly origins?: readonly string[]
  readonly search?: string
  readonly limit: number
  readonly cursor?: string
}

export interface GetMonthlyCashFlowQuery {
  readonly bookId: string
  readonly fromMonth: string
  readonly toMonth: string
}

export interface GetCategorySpendingQuery {
  readonly bookId: string
  readonly from: string
  readonly to: string
  readonly categoryId?: string
}

export interface GetNetWorthQuery {
  readonly bookId: string
  readonly asOf?: string
}
