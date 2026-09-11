import { DomainError } from "./kernel/domain-error.js"

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/
const MAX_INPUT_LENGTH = 80
const MAX_PRECISION = 38
const MAX_SCALE = 18

export class Decimal {
  private constructor(
    private readonly coefficient: bigint,
    private readonly scale: number
  ) {}

  static parse(value: string): Decimal {
    if (value.length > MAX_INPUT_LENGTH || !DECIMAL_PATTERN.test(value)) {
      throw invalidDecimal()
    }

    const negative = value.startsWith("-")
    const unsigned = negative ? value.slice(1) : value
    const [integerPart, fractionalPart = ""] = unsigned.split(".")

    if (integerPart === undefined) {
      throw invalidDecimal()
    }

    const coefficient = BigInt(
      `${negative ? "-" : ""}${integerPart}${fractionalPart}`
    )
    return Decimal.create(coefficient, fractionalPart.length)
  }

  toString(): string {
    if (this.coefficient === 0n) {
      return "0"
    }

    const sign = this.coefficient < 0n ? "-" : ""
    const digits = this.coefficient.toString().replace("-", "")
    if (this.scale === 0) {
      return `${sign}${digits}`
    }

    const padded = digits.padStart(this.scale + 1, "0")
    return `${sign}${padded.slice(0, -this.scale)}.${padded.slice(-this.scale)}`
  }

  add(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale)
    return Decimal.create(
      this.coefficient * powerOfTen(scale - this.scale) +
        other.coefficient * powerOfTen(scale - other.scale),
      scale
    )
  }

  subtract(other: Decimal): Decimal {
    return this.add(other.negate())
  }

  negate(): Decimal {
    return Decimal.create(-this.coefficient, this.scale)
  }

  compare(other: Decimal): -1 | 0 | 1 {
    const scale = Math.max(this.scale, other.scale)
    const left = this.coefficient * powerOfTen(scale - this.scale)
    const right = other.coefficient * powerOfTen(scale - other.scale)

    if (left < right) {
      return -1
    }
    if (left > right) {
      return 1
    }
    return 0
  }

  equals(other: Decimal): boolean {
    return this.compare(other) === 0
  }

  private static create(coefficient: bigint, scale: number): Decimal {
    let normalizedCoefficient = coefficient
    let normalizedScale = scale

    while (normalizedCoefficient !== 0n && normalizedScale > 0) {
      if (normalizedCoefficient % 10n !== 0n) {
        break
      }
      normalizedCoefficient /= 10n
      normalizedScale -= 1
    }

    if (normalizedCoefficient === 0n) {
      normalizedScale = 0
    }

    if (
      normalizedScale > MAX_SCALE ||
      normalizedCoefficient.toString().replace("-", "").length > MAX_PRECISION
    ) {
      throw invalidDecimal()
    }

    return new Decimal(normalizedCoefficient, normalizedScale)
  }
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent)
}

function invalidDecimal(): DomainError {
  return new DomainError(
    "INVALID_INVESTMENT_INPUT",
    "Decimal must use the supported canonical precision"
  )
}
