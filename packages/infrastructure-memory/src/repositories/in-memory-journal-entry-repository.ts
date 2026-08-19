import {
  ApplicationError,
  type DomainFactCollector,
  type JournalEntryRepository,
} from "@workspace/application"
import {
  JournalEntry,
  type BookId,
  type JournalEntryId,
  type JournalEntrySnapshot,
  type LedgerAccountId,
  type PostingId,
} from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryJournalEntryRepository implements JournalEntryRepository {
  constructor(
    private readonly store: InMemoryStore,
    private readonly facts?: DomainFactCollector
  ) {}

  async findById(id: JournalEntryId): Promise<JournalEntry | null> {
    const snapshot = this.store.getJournalEntry(id)
    return snapshot === undefined ? null : JournalEntry.restore(snapshot)
  }

  async findActiveOpeningBalanceByAccount(
    bookId: BookId,
    accountId: LedgerAccountId
  ): Promise<JournalEntry | null> {
    const openingBalanceAccountIds = new Set(
      this.store
        .listAccounts()
        .filter(
          (account) =>
            account.bookId === bookId &&
            account.systemPurpose === "OPENING_BALANCE"
        )
        .map((account) => account.id)
    )
    const snapshot = this.store
      .listJournalEntries()
      .find(
        (entry) =>
          entry.bookId === bookId &&
          entry.reversalOf === undefined &&
          entry.reversedBy === undefined &&
          entry.postings.some((posting) => posting.accountId === accountId) &&
          entry.postings.some((posting) =>
            openingBalanceAccountIds.has(posting.accountId)
          )
      )

    return snapshot === undefined ? null : JournalEntry.restore(snapshot)
  }

  async reserveNextSequence(bookId: BookId): Promise<string> {
    return this.store.reserveNextSequence(bookId)
  }

  async add(entry: JournalEntry): Promise<void> {
    if (this.store.getJournalEntry(entry.id) !== undefined) {
      throw new ApplicationError(
        "DUPLICATE_ENTITY",
        `Journal entry ${entry.id} already exists`
      )
    }

    if (entry.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new journal entry must start at version zero"
      )
    }

    const postingIds = new Set(
      this.store
        .listJournalEntries()
        .flatMap((persisted) => persisted.postings.map((posting) => posting.id))
    )
    if (entry.postings.some((posting) => postingIds.has(posting.id))) {
      throw new ApplicationError(
        "DUPLICATE_ENTITY",
        "A posting with the requested ID already exists"
      )
    }

    this.store.putJournalEntry(entry.toSnapshot())
    this.facts?.record(entry.pullDomainFacts())
  }

  async save(entry: JournalEntry, expectedVersion: number): Promise<void> {
    const persisted = this.store.getJournalEntry(entry.id)
    if (persisted === undefined) {
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        `Journal entry ${entry.id} was not found`
      )
    }

    if (
      persisted.version !== expectedVersion ||
      entry.version !== expectedVersion + 1
    ) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Journal entry ${entry.id} has a conflicting version`
      )
    }

    this.store.putJournalEntry(entry.toSnapshot())
    this.facts?.record(entry.pullDomainFacts())
  }
}

export function journalEntrySnapshot(
  overrides: Partial<JournalEntrySnapshot> = {}
): JournalEntrySnapshot {
  return {
    id: "entry-1" as JournalEntryId,
    bookId: "book-1" as BookId,
    occurredOn: "2026-08-04",
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: "Opening",
    currency: "BRL",
    origin: "SYSTEM",
    postings: [
      {
        id: "posting-1" as PostingId,
        accountId: "account-1" as LedgerAccountId,
        amountMinor: 100n,
        currency: "BRL",
      },
      {
        id: "posting-2" as PostingId,
        accountId: "account-2" as LedgerAccountId,
        amountMinor: -100n,
        currency: "BRL",
      },
    ],
    version: 0,
    ...overrides,
  }
}
