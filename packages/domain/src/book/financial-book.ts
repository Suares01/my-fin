import { Currency } from "../shared/identity/currency.js"
import type { BookId } from "../shared/identity/ids.js"
import { AggregateRoot } from "../shared/kernel/aggregate-root.js"
import { DomainError } from "../shared/kernel/domain-error.js"

export interface FinancialBookSnapshot {
  readonly id: BookId
  readonly name: string
  readonly baseCurrency: string
  readonly timezone: string
  readonly version: number
}

export interface CreateFinancialBookInput {
  readonly id: BookId
  readonly name: string
  readonly baseCurrency: Currency
  readonly timezone: string
}

export class FinancialBook extends AggregateRoot<
  BookId,
  FinancialBookSnapshot
> {
  private constructor(
    id: BookId,
    private readonly bookName: string,
    private readonly currency: Currency,
    private readonly bookTimezone: string,
    private readonly bookVersion: number
  ) {
    super(id)
  }

  static create(input: CreateFinancialBookInput): FinancialBook {
    const name = input.name.trim()
    if (name.length === 0) {
      throw new DomainError("INVALID_BOOK_NAME", "Book name cannot be empty")
    }

    const timezone = input.timezone.trim()
    if (timezone.length === 0) {
      throw new DomainError("INVALID_TIMEZONE", "Book timezone cannot be empty")
    }

    const book = new FinancialBook(
      input.id,
      name,
      input.baseCurrency,
      timezone,
      0
    )
    book.recordFact({
      type: "FinancialBookCreated",
      aggregateId: input.id,
      aggregateVersion: book.version,
      payload: book.toSnapshot(),
    })
    return book
  }

  static restore(snapshot: FinancialBookSnapshot): FinancialBook {
    return new FinancialBook(
      snapshot.id,
      snapshot.name,
      Currency.parse(snapshot.baseCurrency),
      snapshot.timezone,
      snapshot.version
    )
  }

  get name(): string {
    return this.bookName
  }

  get baseCurrency(): Currency {
    return this.currency
  }

  get timezone(): string {
    return this.bookTimezone
  }

  get version(): number {
    return this.bookVersion
  }

  toSnapshot(): FinancialBookSnapshot {
    return {
      id: this.id,
      name: this.name,
      baseCurrency: this.baseCurrency.code,
      timezone: this.timezone,
      version: this.version,
    }
  }
}
