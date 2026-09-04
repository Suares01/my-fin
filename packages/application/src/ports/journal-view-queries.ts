import type {
  BookId,
  JournalEntryId,
  JournalEntryOrigin,
  LedgerAccountId,
  LocalDate,
} from "@workspace/domain"
import type { AccountSummaryView } from "./ledger-read-queries.js"

export type JournalBusinessType =
  | "OPENING_BALANCE"
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"

export type JournalChainStatus = "ACTIVE" | "EDITED" | "CANCELLED"

export interface JournalChainListItem {
  readonly chainId: string
  readonly presentedEntryId: string
  readonly presentedVersion: number
  readonly type: JournalBusinessType
  readonly status: JournalChainStatus
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly origin: JournalEntryOrigin
  readonly amountMinor: string
  readonly currency: string
  readonly financialAccounts: readonly AccountSummaryView[]
  readonly categories: readonly AccountSummaryView[]
  readonly transfer?: {
    readonly source: AccountSummaryView
    readonly destination: AccountSummaryView
  }
}

export interface ListJournalChainsInput {
  readonly bookId: BookId
  readonly from?: LocalDate
  readonly to?: LocalDate
  readonly accountIds?: readonly LedgerAccountId[]
  readonly categoryIds?: readonly LedgerAccountId[]
  readonly types?: readonly JournalBusinessType[]
  readonly origins?: readonly JournalEntryOrigin[]
  readonly search?: string
}

export interface JournalPostingView {
  readonly id: string
  readonly account: AccountSummaryView
  readonly amountMinor: string
  readonly currency: string
  readonly position: number
}

export type JournalHistoryRole = "ORIGINAL" | "REVERSAL" | "REPLACEMENT"

export interface JournalHistoryItem {
  readonly entryId: string
  readonly role: JournalHistoryRole
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly postings: readonly JournalPostingView[]
}

export interface JournalChainDetail extends JournalChainListItem {
  readonly postings: readonly JournalPostingView[]
  readonly history: readonly JournalHistoryItem[]
}

export interface GetJournalChainDetailInput {
  readonly bookId: BookId
  readonly entryId: JournalEntryId
}

export interface JournalViewQueries {
  listJournalChains(
    input: ListJournalChainsInput
  ): Promise<readonly JournalChainListItem[]>
  getJournalChainDetail(
    input: GetJournalChainDetailInput
  ): Promise<JournalChainDetail | null>
}
