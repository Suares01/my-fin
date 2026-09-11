declare const idBrand: unique symbol

export type BrandedId<Tag extends string> = string & {
  readonly [idBrand]: Tag
}

export type BookId = BrandedId<"BookId">
export type LedgerAccountId = BrandedId<"LedgerAccountId">
export type JournalEntryId = BrandedId<"JournalEntryId">
export type PostingId = BrandedId<"PostingId">
export type InvestmentInstrumentId = BrandedId<"InvestmentInstrumentId">
export type InvestmentPositionId = BrandedId<"InvestmentPositionId">
export type InvestmentOperationId = BrandedId<"InvestmentOperationId">
export type InvestmentValuationId = BrandedId<"InvestmentValuationId">

export const bookIdFromString = (value: string): BookId => value as BookId
export const ledgerAccountIdFromString = (value: string): LedgerAccountId =>
  value as LedgerAccountId
export const journalEntryIdFromString = (value: string): JournalEntryId =>
  value as JournalEntryId
export const postingIdFromString = (value: string): PostingId =>
  value as PostingId
export const investmentInstrumentIdFromString = (
  value: string
): InvestmentInstrumentId => value as InvestmentInstrumentId
export const investmentPositionIdFromString = (
  value: string
): InvestmentPositionId => value as InvestmentPositionId
export const investmentOperationIdFromString = (
  value: string
): InvestmentOperationId => value as InvestmentOperationId
export const investmentValuationIdFromString = (
  value: string
): InvestmentValuationId => value as InvestmentValuationId
