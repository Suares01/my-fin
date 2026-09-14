import {
  ApplicationError,
  type BookScopedLookup,
  type InvestmentInstrumentRepository,
} from "@workspace/application"
import {
  InvestmentInstrument,
  instrumentIdentifier,
  type InvestmentInstrumentId,
} from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentInstrumentRepository implements InvestmentInstrumentRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<BookScopedLookup<InvestmentInstrument>> {
    const snapshot = this.store.getInvestmentInstrument(id)
    if (snapshot === undefined) return { kind: "NOT_FOUND" }
    if (snapshot.bookId !== bookId) return { kind: "BOOK_MISMATCH" }
    return { kind: "FOUND", value: InvestmentInstrument.restore(snapshot) }
  }

  async existsWithIdentifier(
    bookId: string,
    identifier: {
      readonly scheme: string
      readonly value: string
      readonly market?: string
    },
    excludeId?: InvestmentInstrumentId
  ): Promise<boolean> {
    const normalized = instrumentIdentifier(identifier as never)
    return this.store
      .listInvestmentInstruments()
      .some(
        (instrument) =>
          instrument.bookId === bookId &&
          instrument.id !== excludeId &&
          instrument.identifiers.some(
            (item) =>
              item.scheme === normalized.scheme &&
              item.value === normalized.value &&
              item.market === normalized.market
          )
      )
  }

  async add(value: InvestmentInstrument): Promise<void> {
    if (
      value.version !== 0 ||
      this.store.getInvestmentInstrument(value.id) !== undefined
    ) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new investment instrument must start at version zero"
      )
    }
    this.store.putInvestmentInstrument(value.toSnapshot())
  }

  async save(
    value: InvestmentInstrument,
    expectedVersion: number
  ): Promise<void> {
    const persisted = this.store.getInvestmentInstrument(value.id)
    if (persisted === undefined)
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        `Investment instrument ${value.id} was not found`
      )
    if (
      persisted.bookId !== value.bookId ||
      persisted.version !== expectedVersion ||
      value.version !== expectedVersion + 1
    ) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Investment instrument ${value.id} has a conflicting version`
      )
    }
    this.store.putInvestmentInstrument(value.toSnapshot())
  }
}
