import type {
  FinancialBook,
  JournalEntry,
  LedgerAccount,
  LedgerAccountKind,
  SystemAccountPurpose,
} from "@workspace/domain"
import type { BookId, JournalEntryId, LedgerAccountId } from "@workspace/domain"
import type { DomainFact } from "@workspace/domain"

export interface FinancialBookRepository {
  findById(id: BookId): Promise<FinancialBook | null>
  add(book: FinancialBook): Promise<void>
  save(book: FinancialBook, expectedVersion: number): Promise<void>
}

export interface LedgerAccountRepository {
  findById(id: LedgerAccountId): Promise<LedgerAccount | null>
  findBySystemPurpose(
    bookId: BookId,
    purpose: SystemAccountPurpose
  ): Promise<LedgerAccount | null>
  existsWithName(
    bookId: BookId,
    kind: LedgerAccountKind,
    normalizedName: string,
    excludeAccountId?: LedgerAccountId
  ): Promise<boolean>
  add(account: LedgerAccount): Promise<void>
  save(account: LedgerAccount, expectedVersion: number): Promise<void>
}

export interface JournalEntryRepository {
  findById(id: JournalEntryId): Promise<JournalEntry | null>
  findActiveOpeningBalanceByAccount(
    bookId: BookId,
    accountId: LedgerAccountId
  ): Promise<JournalEntry | null>
  reserveNextSequence(bookId: BookId): Promise<string>
  add(entry: JournalEntry): Promise<void>
  save(entry: JournalEntry, expectedVersion: number): Promise<void>
}

export interface DomainFactCollector {
  record(facts: readonly DomainFact[]): void
  pull(): readonly DomainFact[]
}

export interface RepositoryContext {
  readonly books: FinancialBookRepository
  readonly accounts: LedgerAccountRepository
  readonly journalEntries: JournalEntryRepository
  readonly facts: DomainFactCollector
}
