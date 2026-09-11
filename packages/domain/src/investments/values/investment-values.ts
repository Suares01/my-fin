import { Decimal } from "../../shared/decimal.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { LocalDate } from "../../shared/local-date.js"
import { Money } from "../../shared/money.js"

const MAX_INVESTMENT_MINOR = 9_223_372_036_854_775_807n

export class Quantity {
  private constructor(private readonly decimal: Decimal) {}

  static parse(value: string): Quantity {
    return new Quantity(assertNonNegative(Decimal.parse(value), "Quantity"))
  }

  toString(): string {
    return this.decimal.toString()
  }

  compare(other: Quantity): -1 | 0 | 1 {
    return this.decimal.compare(other.decimal)
  }

  equals(other: Quantity): boolean {
    return this.decimal.equals(other.decimal)
  }
}

export class Percentage {
  private constructor(private readonly decimal: Decimal) {}

  static parse(value: string): Percentage {
    return new Percentage(assertNonNegative(Decimal.parse(value), "Percentage"))
  }

  toString(): string {
    return this.decimal.toString()
  }
}

export class UnitPrice {
  private constructor(private readonly decimal: Decimal) {}

  static parse(value: string): UnitPrice {
    return new UnitPrice(assertNonNegative(Decimal.parse(value), "Unit price"))
  }

  toString(): string {
    return this.decimal.toString()
  }
}

export function assertInvestmentMoneyRange(value: Money): Money {
  if (
    value.amountMinor < -MAX_INVESTMENT_MINOR ||
    value.amountMinor > MAX_INVESTMENT_MINOR
  ) {
    throw new DomainError(
      "INVESTMENT_VALUE_OUT_OF_RANGE",
      "Investment money must fit the symmetric persisted range"
    )
  }

  return value
}

export function assertRequiredBookCost(value: Money | undefined): Money {
  if (value === undefined) {
    throw new DomainError(
      "INVESTMENT_BOOK_COST_REQUIRED",
      "Investment book cost is required"
    )
  }

  return value
}

export function parseInvestmentLocalDate(value: string): LocalDate {
  try {
    return LocalDate.parse(value)
  } catch (error) {
    if (error instanceof DomainError) {
      throw new DomainError(
        "INVALID_INVESTMENT_DATE",
        "Investment date must be a valid local date"
      )
    }
    throw error
  }
}

function assertNonNegative(value: Decimal, label: string): Decimal {
  if (value.compare(Decimal.parse("0")) < 0) {
    throw new DomainError(
      "INVALID_INVESTMENT_INPUT",
      `${label} cannot be negative`
    )
  }
  return value
}
