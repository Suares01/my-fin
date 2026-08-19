import { describe, expect, it } from "vitest"
import { FinancialBook } from "./financial-book.js"
import { Currency } from "../shared/identity/currency.js"
import { bookIdFromString } from "../shared/identity/ids.js"

const usd = Currency.parse("USD")

function validBook() {
  return FinancialBook.create({
    id: bookIdFromString("book-1"),
    name: "  Household finances  ",
    baseCurrency: usd,
    timezone: "  America/Sao_Paulo  ",
  })
}

describe("FinancialBook", () => {
  it("trims the name and timezone and starts at version zero", () => {
    const book = validBook()

    expect(book.name).toBe("Household finances")
    expect(book.timezone).toBe("America/Sao_Paulo")
    expect(book.baseCurrency.code).toBe("USD")
    expect(book.version).toBe(0)
  })

  it("keeps the base currency immutable through its public API", () => {
    const book = validBook()

    expect(
      Object.getOwnPropertyDescriptor(FinancialBook.prototype, "baseCurrency")
    ).toMatchObject({ get: expect.any(Function), set: undefined })
    expect(book.baseCurrency).toBe(usd)
  })

  it.each([
    ["name", { name: "   ", timezone: "UTC" }],
    ["timezone", { name: "Book", timezone: "   " }],
  ])("rejects an empty %s", (_field, override) => {
    expect(() =>
      FinancialBook.create({
        id: bookIdFromString("book-1"),
        name: override.name,
        baseCurrency: usd,
        timezone: override.timezone,
      })
    ).toThrow()
  })

  it("uses stable error codes for empty name and timezone", () => {
    expect(() =>
      FinancialBook.create({
        id: bookIdFromString("book-1"),
        name: " ",
        baseCurrency: usd,
        timezone: "UTC",
      })
    ).toThrowError(expect.objectContaining({ code: "INVALID_BOOK_NAME" }))

    expect(() =>
      FinancialBook.create({
        id: bookIdFromString("book-1"),
        name: "Book",
        baseCurrency: usd,
        timezone: " ",
      })
    ).toThrowError(expect.objectContaining({ code: "INVALID_TIMEZONE" }))
  })

  it("serializes its state without pending facts", () => {
    const book = validBook()

    expect(book.toSnapshot()).toEqual({
      id: "book-1",
      name: "Household finances",
      baseCurrency: "USD",
      timezone: "America/Sao_Paulo",
      version: 0,
    })
    expect(book.pullDomainFacts()).toHaveLength(1)
    expect(book.toSnapshot()).not.toHaveProperty("pendingFacts")
  })

  it("restores the snapshot value and does not restore pending facts", () => {
    const restored = FinancialBook.restore({
      id: bookIdFromString("book-2"),
      name: "Restored book",
      baseCurrency: "BRL",
      timezone: "UTC",
      version: 4,
    })

    expect(restored.toSnapshot()).toEqual({
      id: "book-2",
      name: "Restored book",
      baseCurrency: "BRL",
      timezone: "UTC",
      version: 4,
    })
    expect(restored.pullDomainFacts()).toEqual([])
  })

  it("creates a FinancialBookCreated fact for a new aggregate", () => {
    const facts = validBook().pullDomainFacts()

    expect(facts).toEqual([
      expect.objectContaining({
        type: "FinancialBookCreated",
        aggregateId: "book-1",
        aggregateVersion: 0,
        payload: expect.objectContaining({ version: 0 }),
      }),
    ])
  })
})
