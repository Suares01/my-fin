import {
  ApplicationError,
  type DomainFactCollector,
  type FinancialBookRepository,
} from "@workspace/application"
import {
  FinancialBook,
  type BookId,
  type FinancialBookSnapshot,
} from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryFinancialBookRepository implements FinancialBookRepository {
  constructor(
    private readonly store: InMemoryStore,
    private readonly facts?: DomainFactCollector
  ) {}

  async findById(id: BookId): Promise<FinancialBook | null> {
    const snapshot = this.store.getBook(id)
    return snapshot === undefined ? null : FinancialBook.restore(snapshot)
  }

  async add(book: FinancialBook): Promise<void> {
    if (this.store.getBook(book.id) !== undefined) {
      throw new ApplicationError(
        "DUPLICATE_ENTITY",
        `Financial book ${book.id} already exists`
      )
    }

    if (book.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new financial book must start at version zero"
      )
    }

    this.store.putBook(book.toSnapshot())
    this.facts?.record(book.pullDomainFacts())
  }

  async save(book: FinancialBook, expectedVersion: number): Promise<void> {
    const persisted = this.store.getBook(book.id)
    if (persisted === undefined) {
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        `Financial book ${book.id} was not found`
      )
    }

    if (
      persisted.version !== expectedVersion ||
      book.version !== expectedVersion + 1
    ) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Financial book ${book.id} has a conflicting version`
      )
    }

    this.store.putBook(book.toSnapshot())
    this.facts?.record(book.pullDomainFacts())
  }
}

export function financialBookSnapshot(
  overrides: Partial<FinancialBookSnapshot> = {}
): FinancialBookSnapshot {
  return {
    id: "book-1" as BookId,
    name: "Main",
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
    version: 0,
    ...overrides,
  }
}
