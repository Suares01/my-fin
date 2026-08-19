import { DomainError } from "../kernel/domain-error.js"

const CURRENCY_PATTERN = /^[A-Z]{3}$/

export class Currency {
  private constructor(private readonly value: string) {}

  static parse(code: string): Currency {
    if (!CURRENCY_PATTERN.test(code)) {
      throw new DomainError(
        "INVALID_CURRENCY",
        "Currency must contain exactly three uppercase ASCII letters"
      )
    }

    return new Currency(code)
  }

  get code(): string {
    return this.value
  }

  equals(other: Currency): boolean {
    return this.code === other.code
  }
}
