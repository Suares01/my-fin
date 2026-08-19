import type {
  BookId,
  JournalEntryId,
  LedgerAccountId,
  PostingId,
} from "@workspace/domain"

export interface Clock {
  now(): string
  localDate(timezone: string): string
}

export interface IdGenerator {
  nextBookId(): BookId
  nextLedgerAccountId(): LedgerAccountId
  nextJournalEntryId(): JournalEntryId
  nextPostingId(): PostingId
  nextEventId(): string
}
