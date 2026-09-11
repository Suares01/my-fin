import { describe, expect, it } from "vitest"
import { DomainError } from "../kernel/domain-error.js"
import { Currency } from "./currency.js"
import {
  bookIdFromString,
  investmentInstrumentIdFromString,
  investmentOperationIdFromString,
  investmentPositionIdFromString,
  investmentValuationIdFromString,
  journalEntryIdFromString,
  ledgerAccountIdFromString,
  postingIdFromString,
} from "./ids.js"
import type { BookId, LedgerAccountId } from "./ids.js"

describe("branded ids", () => {
  it("preserves a book id string deterministically", () => {
    const first = bookIdFromString("book-1")
    const second = bookIdFromString("book-1")

    expect(first).toBe("book-1")
    expect(second).toBe(first)
  })

  it("converts each domain id to its own branded type", () => {
    const bookId = bookIdFromString("book-1")
    const accountId = ledgerAccountIdFromString("account-1")
    const journalEntryId = journalEntryIdFromString("entry-1")
    const postingId = postingIdFromString("posting-1")

    expect(bookId).toBe("book-1")
    expect(accountId).toBe("account-1")
    expect(journalEntryId).toBe("entry-1")
    expect(postingId).toBe("posting-1")
  })

  it("does not allow incompatible branded ids", () => {
    const bookId: BookId = bookIdFromString("book-1")

    // @ts-expect-error BookId and LedgerAccountId are intentionally incompatible.
    const accountId: LedgerAccountId = bookId

    expect(accountId).toBe("book-1")
  })

  it.each([
    ["instrument", investmentInstrumentIdFromString, "instrument-1"],
    ["position", investmentPositionIdFromString, "position-1"],
    ["operation", investmentOperationIdFromString, "operation-1"],
    ["valuation", investmentValuationIdFromString, "valuation-1"],
  ])("preserves the %s investment identity", (_kind, fromString, value) => {
    expect(fromString(value)).toBe(value)
  })
})

describe("Currency", () => {
  it("accepts exactly three uppercase ASCII letters", () => {
    const currency = Currency.parse("USD")

    expect(currency.code).toBe("USD")
    expect(currency.equals(Currency.parse("USD"))).toBe(true)
  })

  it.each(["US", "USDX", "usd", "U$D", " Á"])(
    "rejects invalid currency code %j",
    (code) => {
      expect(() => Currency.parse(code)).toThrow(DomainError)
      expect(() => Currency.parse(code)).toThrowError(
        expect.objectContaining({ code: "INVALID_CURRENCY" })
      )
    }
  )

  it("compares different currencies as unequal", () => {
    const usd = Currency.parse("USD")
    const eur = Currency.parse("EUR")

    expect(usd.equals(eur)).toBe(false)
  })

  it("keeps the parsed code immutable through its public API", () => {
    const currency = Currency.parse("BRL")

    expect(
      Object.getOwnPropertyDescriptor(Currency.prototype, "code")
    ).toMatchObject({ get: expect.any(Function), set: undefined })
    expect(currency.code).toBe("BRL")
  })
})
