import {
  ApplicationError,
  type BookScopedLookup,
  type InvestmentPositionRepository,
} from "@workspace/application"
import {
  InvestmentPosition,
  type InvestmentInstrumentId,
  type InvestmentPositionId,
  type LedgerAccountId,
} from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentPositionRepository implements InvestmentPositionRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findById(
    bookId: string,
    id: InvestmentPositionId
  ): Promise<BookScopedLookup<InvestmentPosition>> {
    const value = this.store.getInvestmentPosition(id)
    if (value === undefined) return { kind: "NOT_FOUND" }
    if (value.bookId !== bookId) return { kind: "BOOK_MISMATCH" }
    return { kind: "FOUND", value: InvestmentPosition.restore(value) }
  }
  async hasAnyForAccount(
    bookId: string,
    id: LedgerAccountId
  ): Promise<boolean> {
    return this.store
      .listInvestmentPositions()
      .some(
        (value) => value.bookId === bookId && value.investmentAccountId === id
      )
  }
  async hasAnyForInstrument(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<boolean> {
    return this.store
      .listInvestmentPositions()
      .some((value) => value.bookId === bookId && value.instrumentId === id)
  }
  async hasOpenForAccount(
    bookId: string,
    id: LedgerAccountId
  ): Promise<boolean> {
    return this.store
      .listInvestmentPositions()
      .some(
        (value) =>
          value.bookId === bookId &&
          value.investmentAccountId === id &&
          value.status === "OPEN"
      )
  }
  async hasOpenForInstrument(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<boolean> {
    return this.store
      .listInvestmentPositions()
      .some(
        (value) =>
          value.bookId === bookId &&
          value.instrumentId === id &&
          value.status === "OPEN"
      )
  }
  async add(value: InvestmentPosition): Promise<void> {
    if (
      value.version !== 0 ||
      this.store.getInvestmentPosition(value.id) !== undefined
    )
      throw concurrent(value.id)
    this.store.putInvestmentPosition(value.toSnapshot())
  }
  async save(
    value: InvestmentPosition,
    expectedVersion: number
  ): Promise<void> {
    const persisted = this.store.getInvestmentPosition(value.id)
    if (persisted === undefined)
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        `Investment position ${value.id} was not found`
      )
    const snapshot = value.toSnapshot()
    if (
      persisted.bookId !== snapshot.bookId ||
      persisted.version !== expectedVersion ||
      snapshot.version !== expectedVersion + 1 ||
      !sameImmutable(persisted, snapshot)
    )
      throw concurrent(value.id)
    this.store.putInvestmentPosition(snapshot)
  }
}
function sameImmutable(
  a: ReturnType<InvestmentPosition["toSnapshot"]>,
  b: ReturnType<InvestmentPosition["toSnapshot"]>
) {
  return (
    a.bookId === b.bookId &&
    a.investmentAccountId === b.investmentAccountId &&
    a.instrumentId === b.instrumentId &&
    a.quantityMode === b.quantityMode
  )
}
function concurrent(id: string) {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    `Investment position ${id} has a conflicting version`
  )
}
