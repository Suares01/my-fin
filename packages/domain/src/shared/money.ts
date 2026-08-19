import { DomainError } from "./kernel/domain-error.js"
import { Currency } from "./identity/currency.js"

export class Money {
  private constructor(
    private readonly minorUnits: bigint,
    private readonly moneyCurrency: Currency
  ) {}

  static of(minorUnits: bigint, currency: Currency): Money {
    return new Money(minorUnits, currency)
  }

  static zero(currency: Currency): Money {
    return Money.of(0n, currency)
  }

  get amountMinor(): bigint {
    return this.minorUnits
  }

  get currency(): Currency {
    return this.moneyCurrency
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return Money.of(this.amountMinor + other.amountMinor, this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return Money.of(this.amountMinor - other.amountMinor, this.currency)
  }

  negate(): Money {
    return Money.of(-this.amountMinor, this.currency)
  }

  absolute(): Money {
    return this.amountMinor < 0n
      ? this.negate()
      : Money.of(this.amountMinor, this.currency)
  }

  equals(other: Money): boolean {
    return (
      this.currency.equals(other.currency) &&
      this.amountMinor === other.amountMinor
    )
  }

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) {
      throw new DomainError(
        "CURRENCY_MISMATCH",
        "Money values must use the same currency"
      )
    }
  }
}
