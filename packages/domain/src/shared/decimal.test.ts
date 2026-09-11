import { describe, expect, it } from "vitest"
import { DomainError } from "./kernel/domain-error.js"
import { Decimal } from "./decimal.js"

describe("Decimal", () => {
  it.each([
    ["0010.5000", "10.5"],
    ["-0.00", "0"],
    ["0000", "0"],
    ["-0010.0500", "-10.05"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(Decimal.parse(input).toString()).toBe(expected)
  })

  it("adds decimal tenths exactly", () => {
    expect(Decimal.parse("0.1").add(Decimal.parse("0.2")).toString()).toBe(
      "0.3"
    )
  })

  it("subtracts decimal tenths exactly", () => {
    expect(Decimal.parse("0.3").subtract(Decimal.parse("0.2")).toString()).toBe(
      "0.1"
    )
  })

  it("aligns different scales without using floating point", () => {
    expect(Decimal.parse("1.2").add(Decimal.parse("0.03")).toString()).toBe(
      "1.23"
    )
  })

  it("negates immutably", () => {
    const original = Decimal.parse("12.30")

    expect(original.negate().toString()).toBe("-12.3")
    expect(original.toString()).toBe("12.3")
  })

  it.each([
    ["0.2", "0.1", 1],
    ["0.1", "0.1", 0],
    ["-0.1", "0.1", -1],
  ] as const)("compares %s and %s as %i", (left, right, expected) => {
    expect(Decimal.parse(left).compare(Decimal.parse(right))).toBe(expected)
  })

  it("compares normalized equality exactly", () => {
    expect(Decimal.parse("1.20").equals(Decimal.parse("01.2"))).toBe(true)
    expect(Decimal.parse("1.20").equals(Decimal.parse("1.21"))).toBe(false)
  })

  it.each([
    ["1e3", "exponential notation"],
    ["+1", "explicit positive sign"],
    [".1", "missing integer part"],
    ["1.", "missing fractional part"],
    ["1".repeat(81), "input longer than 80 characters"],
    ["1." + "1".repeat(19), "scale above 18"],
    ["9".repeat(39), "precision above 38"],
  ])("rejects %s (%s) with INVALID_INVESTMENT_INPUT", (input) => {
    expectInvalidInput(input)
  })

  it("accepts a normalized 38-digit precision boundary", () => {
    expect(Decimal.parse("9".repeat(38)).toString()).toBe("9".repeat(38))
  })

  it("accepts a normalized 18-digit scale boundary", () => {
    expect(Decimal.parse("0." + "1".repeat(18)).toString()).toBe(
      "0." + "1".repeat(18)
    )
  })
})

function expectInvalidInput(input: string): void {
  try {
    Decimal.parse(input)
    throw new Error("expected Decimal.parse to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVALID_INVESTMENT_INPUT")
  }
}
