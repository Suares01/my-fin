import type {
  InvestmentInstrument,
  InvestmentInstrumentId,
  InvestmentOperation,
  InvestmentOperationId,
  InvestmentPosition,
  InvestmentPositionId,
  InvestmentValuationSnapshot,
  LedgerAccountId,
} from "@workspace/domain"
import type { InvestmentRequestReceipt } from "./investment-commands.js"

export type BookScopedLookup<T> =
  | { readonly kind: "FOUND"; readonly value: T }
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "BOOK_MISMATCH" }

export interface InvestmentInstrumentRepository {
  findById(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<BookScopedLookup<InvestmentInstrument>>
  existsWithIdentifier(
    bookId: string,
    identifier: {
      readonly scheme: string
      readonly value: string
      readonly market?: string
    },
    excludeId?: InvestmentInstrumentId
  ): Promise<boolean>
  add(value: InvestmentInstrument): Promise<void>
  save(value: InvestmentInstrument, expectedVersion: number): Promise<void>
}
export interface InvestmentPositionRepository {
  findById(
    bookId: string,
    id: InvestmentPositionId
  ): Promise<BookScopedLookup<InvestmentPosition>>
  hasAnyForAccount(bookId: string, id: LedgerAccountId): Promise<boolean>
  hasAnyForInstrument(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<boolean>
  hasOpenForAccount(bookId: string, id: LedgerAccountId): Promise<boolean>
  hasOpenForInstrument(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<boolean>
  add(value: InvestmentPosition): Promise<void>
  save(value: InvestmentPosition, expectedVersion: number): Promise<void>
}
export interface InvestmentOperationRepository {
  findById(
    bookId: string,
    id: InvestmentOperationId
  ): Promise<BookScopedLookup<InvestmentOperation>>
  findLastEffective(
    bookId: string,
    positionId: InvestmentPositionId,
    excludeOperationId?: InvestmentOperationId
  ): Promise<InvestmentOperation | null>
  add(value: InvestmentOperation): Promise<void>
  saveLineage(
    value: InvestmentOperation,
    expectedVersion: number
  ): Promise<void>
}
export interface InvestmentValuationStore {
  append(value: InvestmentValuationSnapshot): Promise<void>
}
export interface InvestmentRequestStore {
  find(
    bookId: string,
    requestId: string
  ): Promise<InvestmentRequestReceipt | null>
  add(receipt: InvestmentRequestReceipt): Promise<void>
}
export interface InvestmentSequenceStore {
  next(bookId: string): Promise<string>
}
export interface InvestmentCashState {
  readonly investmentAccountId: string
  readonly cashMinor: string
  readonly currency: string
}
export interface InvestmentTransactionReads {
  hasActiveSettlementDependents(
    bookId: string,
    accountId: LedgerAccountId
  ): Promise<boolean>
  accountLedgerBalance(
    bookId: string,
    accountId: LedgerAccountId,
    asOf?: string
  ): Promise<string>
  accountCash(
    bookId: string,
    accountIds: readonly LedgerAccountId[],
    asOf: string
  ): Promise<readonly InvestmentCashState[]>
}
