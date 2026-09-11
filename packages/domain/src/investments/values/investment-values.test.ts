import { describe, expect, it } from "vitest"
import { Currency } from "../../shared/identity/currency.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { LocalDate } from "../../shared/local-date.js"
import { Money } from "../../shared/money.js"
import {
  assertInvestmentMoneyRange,
  assertRequiredBookCost,
  parseInvestmentLocalDate,
  Percentage,
  Quantity,
  UnitPrice,
} from "./investment-values.js"

const BRL = Currency.parse("BRL")
const MAX_INVESTMENT_MINOR = 9_223_372_036_854_775_807n

describe("investment values", () => {
  it.each([
    ["0", "0"],
    ["10.500", "10.5"],
  ])("accepts non-negative quantity %s", (input, expected) => {
    expect(Quantity.parse(input).toString()).toBe(expected)
  })

  it("rejects a negative quantity", () => {
    expectCode(() => Quantity.parse("-0.1"), "INVALID_INVESTMENT_INPUT")
  })

  it.each([
    ["0", "0"],
    ["105", "105"],
    ["12.50", "12.5"],
  ])(
    "accepts non-negative percentage %s without a 100 cap",
    (input, expected) => {
      expect(Percentage.parse(input).toString()).toBe(expected)
    }
  )

  it("rejects a negative percentage", () => {
    expectCode(() => Percentage.parse("-0.01"), "INVALID_INVESTMENT_INPUT")
  })

  it.each([
    ["0", "0"],
    ["10.2500", "10.25"],
  ])("accepts non-negative unit price %s", (input, expected) => {
    expect(UnitPrice.parse(input).toString()).toBe(expected)
  })

  it("rejects a negative unit price", () => {
    expectCode(() => UnitPrice.parse("-1"), "INVALID_INVESTMENT_INPUT")
  })

  it.each([
    [MAX_INVESTMENT_MINOR, MAX_INVESTMENT_MINOR],
    [-MAX_INVESTMENT_MINOR, -MAX_INVESTMENT_MINOR],
  ])("accepts the symmetric persisted money boundary %s", (amount) => {
    expect(assertInvestmentMoneyRange(Money.of(amount, BRL)).amountMinor).toBe(
      amount
    )
  })

  it.each([[MAX_INVESTMENT_MINOR + 1n], [-MAX_INVESTMENT_MINOR - 1n]])(
    "rejects money outside the symmetric persisted boundary %s",
    (amount) => {
      expectCode(
        () => assertInvestmentMoneyRange(Money.of(amount, BRL)),
        "INVESTMENT_VALUE_OUT_OF_RANGE"
      )
    }
  )

  it("distinguishes a missing book cost from explicit zero", () => {
    expect(assertRequiredBookCost(Money.zero(BRL)).amountMinor).toBe(0n)
    expectCode(
      () => assertRequiredBookCost(undefined),
      "INVESTMENT_BOOK_COST_REQUIRED"
    )
  })

  it("parses a valid investment local date", () => {
    expect(
      parseInvestmentLocalDate("2026-09-10").equals(
        LocalDate.parse("2026-09-10")
      )
    ).toBe(true)
  })

  it("uses the stable investment date code for an invalid date", () => {
    expectCode(
      () => parseInvestmentLocalDate("2026-02-30"),
      "INVALID_INVESTMENT_DATE"
    )
  })
})

function expectCode(action: () => unknown, code: string): void {
  try {
    action()
    throw new Error("expected action to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
  }
}
