import type {
  FinancialBookSnapshot,
  InvestmentInstrumentSnapshot,
  InvestmentOperationSnapshot,
  InvestmentPositionSnapshot,
  InvestmentValuationSnapshot,
  JournalEntrySnapshot,
  LedgerAccountSnapshot,
} from "@workspace/domain"
import type { InvestmentRequestReceipt } from "@workspace/application"
import type {
  BookId,
  InvestmentInstrumentId,
  InvestmentOperationId,
  InvestmentPositionId,
  InvestmentValuationId,
  JournalEntryId,
  LedgerAccountId,
} from "@workspace/domain"

export interface InMemoryStoreSnapshot {
  readonly books: readonly FinancialBookSnapshot[]
  readonly accounts: readonly LedgerAccountSnapshot[]
  readonly journalEntries: readonly JournalEntrySnapshot[]
  readonly journalSequences: readonly JournalSequenceSnapshot[]
  readonly investmentInstruments: readonly InvestmentInstrumentSnapshot[]
  readonly investmentPositions: readonly InvestmentPositionSnapshot[]
  readonly investmentOperations: readonly InvestmentOperationSnapshot[]
  readonly investmentValuations: readonly InvestmentValuationSnapshot[]
  readonly investmentRequests: readonly InvestmentRequestReceipt[]
  readonly investmentSequences: readonly JournalSequenceSnapshot[]
}

export interface JournalSequenceSnapshot {
  readonly bookId: BookId
  readonly lastSequence: string
}

export class InMemoryStore {
  private readonly books = new Map<string, FinancialBookSnapshot>()
  private readonly accounts = new Map<string, LedgerAccountSnapshot>()
  private readonly journalEntries = new Map<string, JournalEntrySnapshot>()
  private readonly journalSequences = new Map<string, bigint>()
  private readonly investmentInstruments = new Map<
    string,
    InvestmentInstrumentSnapshot
  >()
  private readonly investmentPositions = new Map<
    string,
    InvestmentPositionSnapshot
  >()
  private readonly investmentOperations = new Map<
    string,
    InvestmentOperationSnapshot
  >()
  private readonly investmentValuations = new Map<
    string,
    InvestmentValuationSnapshot
  >()
  private readonly investmentRequests = new Map<
    string,
    InvestmentRequestReceipt
  >()
  private readonly investmentSequences = new Map<string, bigint>()

  snapshot(): InMemoryStoreSnapshot {
    return {
      books: [...this.books.values()].map(cloneBook),
      accounts: [...this.accounts.values()].map(cloneAccount),
      journalEntries: [...this.journalEntries.values()].map(cloneJournalEntry),
      journalSequences: [...this.journalSequences.entries()].map(
        ([bookId, lastSequence]) => ({
          bookId: bookId as BookId,
          lastSequence: lastSequence.toString(),
        })
      ),
      investmentInstruments: [...this.investmentInstruments.values()].map(
        cloneInvestmentInstrument
      ),
      investmentPositions: [...this.investmentPositions.values()].map(
        cloneInvestmentPosition
      ),
      investmentOperations: [...this.investmentOperations.values()].map(
        cloneInvestmentOperation
      ),
      investmentValuations: [...this.investmentValuations.values()].map(
        cloneInvestmentValuation
      ),
      investmentRequests: [...this.investmentRequests.values()].map(
        cloneInvestmentRequest
      ),
      investmentSequences: [...this.investmentSequences.entries()].map(
        ([bookId, lastSequence]) => ({
          bookId: bookId as BookId,
          lastSequence: lastSequence.toString(),
        })
      ),
    }
  }

  restore(snapshot: InMemoryStoreSnapshot): void {
    this.books.clear()
    this.accounts.clear()
    this.journalEntries.clear()
    this.journalSequences.clear()
    this.investmentInstruments.clear()
    this.investmentPositions.clear()
    this.investmentOperations.clear()
    this.investmentValuations.clear()
    this.investmentRequests.clear()
    this.investmentSequences.clear()

    for (const book of snapshot.books) {
      this.books.set(book.id, cloneBook(book))
    }
    for (const account of snapshot.accounts) {
      this.accounts.set(account.id, cloneAccount(account))
    }
    for (const entry of snapshot.journalEntries) {
      this.journalEntries.set(entry.id, cloneJournalEntry(entry))
    }
    for (const sequence of snapshot.journalSequences) {
      this.journalSequences.set(sequence.bookId, BigInt(sequence.lastSequence))
    }
    for (const value of snapshot.investmentInstruments) {
      this.investmentInstruments.set(value.id, cloneInvestmentInstrument(value))
    }
    for (const value of snapshot.investmentPositions) {
      this.investmentPositions.set(value.id, cloneInvestmentPosition(value))
    }
    for (const value of snapshot.investmentOperations) {
      this.investmentOperations.set(value.id, cloneInvestmentOperation(value))
    }
    for (const value of snapshot.investmentValuations) {
      this.investmentValuations.set(value.id, cloneInvestmentValuation(value))
    }
    for (const value of snapshot.investmentRequests) {
      this.investmentRequests.set(
        requestKey(value.bookId, value.requestId),
        cloneInvestmentRequest(value)
      )
    }
    for (const sequence of snapshot.investmentSequences) {
      this.investmentSequences.set(
        sequence.bookId,
        BigInt(sequence.lastSequence)
      )
    }
  }

  getBook(id: BookId): FinancialBookSnapshot | undefined {
    const snapshot = this.books.get(id)
    return snapshot === undefined ? undefined : cloneBook(snapshot)
  }

  getAccount(id: LedgerAccountId): LedgerAccountSnapshot | undefined {
    const snapshot = this.accounts.get(id)
    return snapshot === undefined ? undefined : cloneAccount(snapshot)
  }

  getJournalEntry(id: JournalEntryId): JournalEntrySnapshot | undefined {
    const snapshot = this.journalEntries.get(id)
    return snapshot === undefined ? undefined : cloneJournalEntry(snapshot)
  }

  listBooks(): readonly FinancialBookSnapshot[] {
    return [...this.books.values()].map(cloneBook)
  }

  listAccounts(): readonly LedgerAccountSnapshot[] {
    return [...this.accounts.values()].map(cloneAccount)
  }

  listJournalEntries(): readonly JournalEntrySnapshot[] {
    return [...this.journalEntries.values()].map(cloneJournalEntry)
  }

  putBook(snapshot: FinancialBookSnapshot): void {
    this.books.set(snapshot.id, cloneBook(snapshot))
  }

  putAccount(snapshot: LedgerAccountSnapshot): void {
    this.accounts.set(snapshot.id, cloneAccount(snapshot))
  }

  putJournalEntry(snapshot: JournalEntrySnapshot): void {
    this.journalEntries.set(snapshot.id, cloneJournalEntry(snapshot))
  }

  reserveNextSequence(bookId: BookId): string {
    const nextSequence = (this.journalSequences.get(bookId) ?? 0n) + 1n
    this.journalSequences.set(bookId, nextSequence)
    return nextSequence.toString()
  }

  getInvestmentInstrument(
    id: InvestmentInstrumentId
  ): InvestmentInstrumentSnapshot | undefined {
    const value = this.investmentInstruments.get(id)
    return value === undefined ? undefined : cloneInvestmentInstrument(value)
  }

  listInvestmentInstruments(): readonly InvestmentInstrumentSnapshot[] {
    return [...this.investmentInstruments.values()].map(
      cloneInvestmentInstrument
    )
  }
  putInvestmentInstrument(value: InvestmentInstrumentSnapshot): void {
    this.investmentInstruments.set(value.id, cloneInvestmentInstrument(value))
  }
  getInvestmentPosition(
    id: InvestmentPositionId
  ): InvestmentPositionSnapshot | undefined {
    const value = this.investmentPositions.get(id)
    return value === undefined ? undefined : cloneInvestmentPosition(value)
  }
  listInvestmentPositions(): readonly InvestmentPositionSnapshot[] {
    return [...this.investmentPositions.values()].map(cloneInvestmentPosition)
  }
  putInvestmentPosition(value: InvestmentPositionSnapshot): void {
    this.investmentPositions.set(value.id, cloneInvestmentPosition(value))
  }
  getInvestmentOperation(
    id: InvestmentOperationId
  ): InvestmentOperationSnapshot | undefined {
    const value = this.investmentOperations.get(id)
    return value === undefined ? undefined : cloneInvestmentOperation(value)
  }
  listInvestmentOperations(): readonly InvestmentOperationSnapshot[] {
    return [...this.investmentOperations.values()].map(cloneInvestmentOperation)
  }
  putInvestmentOperation(value: InvestmentOperationSnapshot): void {
    this.investmentOperations.set(value.id, cloneInvestmentOperation(value))
  }
  getInvestmentValuation(
    id: InvestmentValuationId
  ): InvestmentValuationSnapshot | undefined {
    const value = this.investmentValuations.get(id)
    return value === undefined ? undefined : cloneInvestmentValuation(value)
  }
  listInvestmentValuations(): readonly InvestmentValuationSnapshot[] {
    return [...this.investmentValuations.values()].map(cloneInvestmentValuation)
  }
  putInvestmentValuation(value: InvestmentValuationSnapshot): void {
    this.investmentValuations.set(value.id, cloneInvestmentValuation(value))
  }
  getInvestmentRequest(
    bookId: BookId,
    requestId: string
  ): InvestmentRequestReceipt | undefined {
    const value = this.investmentRequests.get(requestKey(bookId, requestId))
    return value === undefined ? undefined : cloneInvestmentRequest(value)
  }
  putInvestmentRequest(value: InvestmentRequestReceipt): void {
    this.investmentRequests.set(
      requestKey(value.bookId, value.requestId),
      cloneInvestmentRequest(value)
    )
  }
  reserveNextInvestmentSequence(bookId: BookId): string {
    const next = (this.investmentSequences.get(bookId) ?? 0n) + 1n
    this.investmentSequences.set(bookId, next)
    return next.toString()
  }
}

function cloneBook(snapshot: FinancialBookSnapshot): FinancialBookSnapshot {
  return { ...snapshot }
}

function cloneAccount(snapshot: LedgerAccountSnapshot): LedgerAccountSnapshot {
  return { ...snapshot }
}

function cloneJournalEntry(
  snapshot: JournalEntrySnapshot
): JournalEntrySnapshot {
  return {
    ...snapshot,
    postings: snapshot.postings.map((posting) => ({ ...posting })),
  }
}

function cloneInvestmentInstrument(
  value: InvestmentInstrumentSnapshot
): InvestmentInstrumentSnapshot {
  return {
    ...value,
    identifiers: value.identifiers.map((identifier) => ({ ...identifier })),
  }
}
function cloneInvestmentPosition(
  value: InvestmentPositionSnapshot
): InvestmentPositionSnapshot {
  return {
    ...value,
    ...(value.fixedIncomeTerms === undefined
      ? {}
      : { fixedIncomeTerms: { ...value.fixedIncomeTerms } }),
  }
}
function cloneInvestmentOperation(
  value: InvestmentOperationSnapshot
): InvestmentOperationSnapshot {
  return {
    ...value,
    categories: { ...value.categories },
    positionBefore: { ...value.positionBefore },
  }
}
function cloneInvestmentValuation(
  value: InvestmentValuationSnapshot
): InvestmentValuationSnapshot {
  return { ...value }
}
function cloneInvestmentRequest(
  value: InvestmentRequestReceipt
): InvestmentRequestReceipt {
  return {
    ...value,
    result: {
      ...value.result,
      journalEntryIds: [...value.result.journalEntryIds],
      warnings: value.result.warnings.map((warning) => ({ ...warning })),
    },
  }
}
function requestKey(bookId: string, requestId: string): string {
  return `${bookId}:${requestId}`
}
