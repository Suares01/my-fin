import { describe, expect, it } from "vitest"
import {
  bookIdFromString,
  investmentPositionIdFromString,
  investmentValuationIdFromString,
} from "../../shared/identity/ids.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { InvestmentValuation } from "./investment-valuation.js"

const input = (
  overrides: Partial<Parameters<typeof InvestmentValuation.create>[0]> = {}
) => ({
  id: investmentValuationIdFromString("valuation-1"),
  bookId: bookIdFromString("book-1"),
  positionId: investmentPositionIdFromString("position-1"),
  allocationRevision: 2,
  valuedAt: "2026-01-02T10:00:00.000Z",
  valuedOn: "2026-01-02",
  recordedAt: "2026-01-02T12:00:00.000Z",
  recordSequence: "1",
  currency: "BRL",
  positionCurrency: "BRL",
  grossValueMinor: "1200",
  positionQuantity: "10",
  quantity: "10",
  unitPrice: "120",
  ...overrides,
})

describe("InvestmentValuation", () => {
  it("creates an immutable manual observation without facts", () => {
    const valuation = InvestmentValuation.create(input())
    expect(valuation.toSnapshot()).toMatchObject({
      source: "MANUAL",
      grossValueMinor: "1200",
      allocationRevision: 2,
      quantity: "10",
    })
    expect(valuation.pullDomainFacts()).toEqual([])
  })
  it("preserves unknown optional net and withdrawable values", () => {
    expect(
      InvestmentValuation.create(
        input({ netValueMinor: undefined, withdrawableValueMinor: undefined })
      ).toSnapshot()
    ).toMatchObject({
      netValueMinor: undefined,
      withdrawableValueMinor: undefined,
      grossValueMinor: "1200",
    })
  })
  it("accepts independently supplied non-negative optional values", () => {
    expect(
      InvestmentValuation.create(
        input({ netValueMinor: "1180", withdrawableValueMinor: "900" })
      ).toSnapshot()
    ).toMatchObject({ netValueMinor: "1180", withdrawableValueMinor: "900" })
  })
  it.each(["-1", "-0"])("rejects negative gross %s", (grossValueMinor) =>
    expectInvalid(() => InvestmentValuation.create(input({ grossValueMinor })))
  )
  it.each(["netValueMinor", "withdrawableValueMinor"] as const)(
    "rejects negative optional %s",
    (field) =>
      expectInvalid(() => InvestmentValuation.create(input({ [field]: "-1" })))
  )
  it("rejects a currency divergent from the position", () =>
    expectInvalid(() => InvestmentValuation.create(input({ currency: "USD" }))))
  it("rejects a quantity divergent from the declared position revision", () =>
    expectInvalid(() => InvestmentValuation.create(input({ quantity: "9" }))))
  it("rejects quantity and unit price for amount positions", () =>
    expectInvalid(() =>
      InvestmentValuation.create(
        input({
          positionQuantity: undefined,
          quantity: undefined,
          unitPrice: "120",
        })
      )
    ))
  it("accepts amount positions without quantity or unit price", () =>
    expect(
      InvestmentValuation.create(
        input({
          positionQuantity: undefined,
          quantity: undefined,
          unitPrice: undefined,
        })
      ).toSnapshot().quantity
    ).toBeUndefined())
  it("rejects a negative unit price", () =>
    expectInvalid(() => InvestmentValuation.create(input({ unitPrice: "-1" }))))
  it("keeps decimal unit price canonical", () =>
    expect(
      InvestmentValuation.create(input({ unitPrice: "120.500" })).toSnapshot()
        .unitPrice
    ).toBe("120.5"))
  it("rejects an invalid timestamp and local date", () => {
    expectInvalid(() => InvestmentValuation.create(input({ valuedAt: "bad" })))
    expectInvalid(() =>
      InvestmentValuation.create(input({ valuedOn: "2026-02-30" }))
    )
  })
  it("rejects a non-positive record sequence", () =>
    expectInvalid(() =>
      InvestmentValuation.create(input({ recordSequence: "0" }))
    ))
  it("clones the immutable snapshot", () => {
    const valuation = InvestmentValuation.create(input())
    const snapshot = valuation.toSnapshot() as { grossValueMinor: string }
    snapshot.grossValueMinor = "1"
    expect(valuation.toSnapshot().grossValueMinor).toBe("1200")
  })
})
function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected valuation rejection")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVALID_INVESTMENT_VALUATION")
  }
}
