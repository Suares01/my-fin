import {
  ApplicationError,
  type BookScopedLookup,
  type InvestmentOperationRepository,
} from "@workspace/application"
import {
  InvestmentOperation,
  type InvestmentOperationId,
  type InvestmentPositionId,
  type JournalEntryId,
} from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentOperationRepository implements InvestmentOperationRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(
    bookId: string,
    id: InvestmentOperationId
  ): Promise<BookScopedLookup<InvestmentOperation>> {
    const snapshot = this.store.getInvestmentOperation(id)
    if (snapshot === undefined) return { kind: "NOT_FOUND" }
    if (snapshot.bookId !== bookId) return { kind: "BOOK_MISMATCH" }
    return { kind: "FOUND", value: InvestmentOperation.restore(snapshot) }
  }

  async findLastEffective(
    bookId: string,
    positionId: InvestmentPositionId,
    excludeOperationId?: InvestmentOperationId
  ): Promise<InvestmentOperation | null> {
    const operations = this.store
      .listInvestmentOperations()
      .filter(
        (item) =>
          item.bookId === bookId &&
          item.positionId === positionId &&
          item.id !== excludeOperationId
      )
      .map(InvestmentOperation.restore)
    return InvestmentOperation.lastEffective(operations) ?? null
  }

  async findOwnerOfJournal(
    bookId: string,
    id: JournalEntryId
  ): Promise<InvestmentOperation | null> {
    const snapshot = this.store
      .listInvestmentOperations()
      .find((item) => item.bookId === bookId && item.journalEntryId === id)
    return snapshot === undefined ? null : InvestmentOperation.restore(snapshot)
  }

  async add(value: InvestmentOperation): Promise<void> {
    if (value.version !== 0 || this.store.getInvestmentOperation(value.id))
      throw concurrent(value.id)
    this.store.putInvestmentOperation(value.toSnapshot())
  }

  async saveLineage(
    value: InvestmentOperation,
    expectedVersion: number
  ): Promise<void> {
    const persisted = this.store.getInvestmentOperation(value.id)
    if (persisted === undefined)
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        `Investment operation ${value.id} was not found`
      )
    const snapshot = value.toSnapshot()
    if (
      persisted.bookId !== snapshot.bookId ||
      persisted.positionId !== snapshot.positionId ||
      persisted.version !== expectedVersion ||
      snapshot.version !== expectedVersion + 1 ||
      !sameOperation(persisted, snapshot)
    )
      throw concurrent(value.id)
    this.store.putInvestmentOperation(snapshot)
  }
}

function sameOperation(
  persisted: ReturnType<InvestmentOperation["toSnapshot"]>,
  next: ReturnType<InvestmentOperation["toSnapshot"]>
): boolean {
  const {
    reversedBy: persistedReversedBy,
    replacedBy: persistedReplacedBy,
    version: persistedVersion,
    ...persistedRest
  } = persisted
  const {
    reversedBy: nextReversedBy,
    replacedBy: nextReplacedBy,
    version: nextVersion,
    ...nextRest
  } = next
  void persistedReversedBy
  void persistedReplacedBy
  void nextReversedBy
  void nextReplacedBy
  void persistedVersion
  void nextVersion
  return JSON.stringify(persistedRest) === JSON.stringify(nextRest)
}

function concurrent(id: string): ApplicationError {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    `Investment operation ${id} has a conflicting version`
  )
}
