import { describe, expect, it } from "vitest"
import { DomainError } from "./kernel/domain-error.js"
import { Currency } from "./identity/currency.js"
import { Money } from "./money.js"

const USD = Currency.parse("USD")
const EUR = Currency.parse("EUR")

describe("Money", () => {
  it("stores minor units as bigint", () => {
    const money = Money.of(123n, USD)

    expect(money.amountMinor).toBe(123n)
    expect(typeof money.amountMinor).toBe("bigint")
    expect(money.currency.code).toBe("USD")
  })

  it("creates a zero value in the requested currency", () => {
    const money = Money.zero(EUR)

    expect(money.amountMinor).toBe(0n)
    expect(money.currency.code).toBe("EUR")
  })

  it("adds values without mutating either input", () => {
    const first = Money.of(125n, USD)
    const second = Money.of(75n, USD)

    const result = first.add(second)

    expect(result.amountMinor).toBe(200n)
    expect(result.currency.code).toBe("USD")
    expect(result).not.toBe(first)
    expect(first.amountMinor).toBe(125n)
    expect(second.amountMinor).toBe(75n)
  })

  it("subtracts values with signed bigint arithmetic", () => {
    const result = Money.of(125n, USD).subtract(Money.of(175n, USD))

    expect(result.amountMinor).toBe(-50n)
  })

  it("negates a value immutably", () => {
    const original = Money.of(50n, USD)
    const result = original.negate()

    expect(result.amountMinor).toBe(-50n)
    expect(original.amountMinor).toBe(50n)
    expect(result).not.toBe(original)
  })

  it.each([
    ["positive", 50n, 50n],
    ["negative", -50n, 50n],
    ["zero", 0n, 0n],
  ])("returns the absolute value for %s input", (_name, input, expected) => {
    expect(Money.of(input, USD).absolute().amountMinor).toBe(expected)
  })

  it("compares equal values only when amount and currency match", () => {
    expect(Money.of(50n, USD).equals(Money.of(50n, USD))).toBe(true)
    expect(Money.of(50n, USD).equals(Money.of(51n, USD))).toBe(false)
    expect(Money.of(50n, USD).equals(Money.of(50n, EUR))).toBe(false)
  })

  it("rejects addition of different currencies with the exact error code", () => {
    expect(() => Money.of(50n, USD).add(Money.of(50n, EUR))).toThrowError(
      expect.objectContaining({ code: "CURRENCY_MISMATCH" })
    )
  })

  it("rejects subtraction of different currencies with the exact error code", () => {
    expect(() => Money.of(50n, USD).subtract(Money.of(50n, EUR))).toThrowError(
      expect.objectContaining({ code: "CURRENCY_MISMATCH" })
    )
  })

  it("uses a DomainError for currency mismatch rather than a generic error", () => {
    try {
      Money.of(50n, USD).add(Money.of(50n, EUR))
      throw new Error("expected addition to reject")
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError)
      expect((error as DomainError).code).toBe("CURRENCY_MISMATCH")
    }
  })
})
