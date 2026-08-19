import type {
  BookId,
  JournalEntryOrigin,
  LedgerAccountId,
  LedgerAccountKind,
  LocalDate,
} from "@workspace/domain"
import type { AccountBalanceItemView } from "./queries.js"

export interface AccountSummaryView {
  readonly id: string
  readonly name: string
  readonly kind: LedgerAccountKind
}

export interface StatementCursorKey {
  readonly occurredOn: string
  readonly sequence: string
  readonly postingPosition: number
}

export interface JournalEntryCursorKey {
  readonly occurredOn: string
  readonly sequence: string
}

export interface QuerySlice<T, TKey> {
  readonly items: readonly T[]
  readonly nextKey: TKey | null
}

export interface AccountStatementItem {
  readonly entryId: string
  readonly postingId: string
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly rawAmountMinor: string
  readonly displayAmountMinor: string
  readonly runningBalanceMinor: string
  readonly currency: string
  readonly origin: JournalEntryOrigin
  readonly counterpartyAccounts: readonly AccountSummaryView[]
  readonly isReversal: boolean
  readonly isReversed: boolean
}

export interface JournalEntryListItem {
  readonly id: string
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly origin: JournalEntryOrigin
  readonly financialAccounts: readonly AccountSummaryView[]
  readonly categories: readonly AccountSummaryView[]
  readonly incomeMinor: string
  readonly expenseMinor: string
  readonly transferMinor: string
  readonly currency: string
  readonly isSplit: boolean
  readonly isReversal: boolean
  readonly isReversed: boolean
}

export interface ListAccountBalancesInput {
  readonly bookId: BookId
  readonly accountKinds?: readonly LedgerAccountKind[]
  readonly asOf?: LocalDate
  readonly includeArchived: boolean
  readonly includeZeroBalance: boolean
}

export interface ListAccountStatementInput {
  readonly bookId: BookId
  readonly accountId: LedgerAccountId
  readonly from?: LocalDate
  readonly to?: LocalDate
  readonly limit: number
  readonly cursor?: StatementCursorKey
}

export interface ListJournalEntriesInput {
  readonly bookId: BookId
  readonly from?: LocalDate
  readonly to?: LocalDate
  readonly accountIds?: readonly LedgerAccountId[]
  readonly categoryIds?: readonly LedgerAccountId[]
  readonly origins?: readonly JournalEntryOrigin[]
  readonly search?: string
  readonly limit: number
  readonly cursor?: JournalEntryCursorKey
}

export interface LedgerReadQueries {
  listAccountBalances(
    input: ListAccountBalancesInput
  ): Promise<readonly AccountBalanceItemView[]>
  listAccountStatement(
    input: ListAccountStatementInput
  ): Promise<QuerySlice<AccountStatementItem, StatementCursorKey>>
  listJournalEntries(
    input: ListJournalEntriesInput
  ): Promise<QuerySlice<JournalEntryListItem, JournalEntryCursorKey>>
}
