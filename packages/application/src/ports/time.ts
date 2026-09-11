import type {
  BookId,
  InvestmentInstrumentId,
  InvestmentOperationId,
  InvestmentPositionId,
  InvestmentValuationId,
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
  nextInvestmentInstrumentId(): InvestmentInstrumentId
  nextInvestmentPositionId(): InvestmentPositionId
  nextInvestmentOperationId(): InvestmentOperationId
  nextInvestmentValuationId(): InvestmentValuationId
  nextEventId(): string
}
