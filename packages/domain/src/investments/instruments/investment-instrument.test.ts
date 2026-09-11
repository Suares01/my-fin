import { describe, expect, it } from "vitest"
import { DomainError } from "../../shared/kernel/domain-error.js"
import {
  bookIdFromString,
  investmentInstrumentIdFromString,
} from "../../shared/identity/ids.js"
import {
  InvestmentInstrument,
  instrumentIdentifier,
  investmentInstrumentClassFor,
} from "./investment-instrument.js"

const input = (
  overrides: Partial<Parameters<typeof InvestmentInstrument.create>[0]> = {}
) => ({
  id: investmentInstrumentIdFromString("instrument-1"),
  bookId: bookIdFromString("book-1"),
  name: " CDB Banco ABC ",
  type: "CDB" as const,
  currency: "BRL",
  baseCurrency: "BRL",
  ...overrides,
})

describe("InvestmentInstrument", () => {
  it("creates an active instrument without identifiers or issuer", () => {
    const instrument = InvestmentInstrument.create(input())
    expect(instrument.toSnapshot()).toMatchObject({
      name: "CDB Banco ABC",
      normalizedName: "cdb banco abc",
      status: "ACTIVE",
      version: 0,
      identifiers: [],
    })
  })
  it.each([
    ["CDB", "FIXED_INCOME"],
    ["RDB", "FIXED_INCOME"],
    ["LCI", "FIXED_INCOME"],
    ["LCA", "FIXED_INCOME"],
    ["LC", "FIXED_INCOME"],
    ["CRI", "FIXED_INCOME"],
    ["CRA", "FIXED_INCOME"],
    ["DEBENTURE", "FIXED_INCOME"],
    ["LF", "FIXED_INCOME"],
    ["LIG", "FIXED_INCOME"],
    ["TREASURY", "FIXED_INCOME"],
    ["STOCK", "EQUITY"],
    ["BDR", "EQUITY"],
    ["ETF", "FUND"],
    ["REAL_ESTATE_FUND", "FUND"],
    ["MUTUAL_FUND", "FUND"],
    ["PGBL", "PENSION"],
    ["VGBL", "PENSION"],
    ["COE", "STRUCTURED"],
    ["CRYPTO_ASSET", "CRYPTO"],
    ["OTHER", "OTHER"],
  ] as const)("derives %s as %s", (type, instrumentClass) => {
    expect(investmentInstrumentClassFor(type)).toBe(instrumentClass)
  })
  it("rejects a currency distinct from the book base currency", () => {
    expect(() =>
      InvestmentInstrument.create(input({ currency: "USD" }))
    ).toThrowError(
      expect.objectContaining({ code: "INVESTMENT_CURRENCY_MISMATCH" })
    )
  })
  it("normalizes ticker, ISIN and market uppercase", () => {
    expect(
      instrumentIdentifier({
        scheme: "TICKER",
        value: " petr4 ",
        market: " b3 ",
      })
    ).toEqual({ scheme: "TICKER", value: "PETR4", market: "B3" })
  })
  it("preserves registration identifier internal text", () => {
    expect(
      instrumentIdentifier({ scheme: "REGISTRATION_NUMBER", value: " 12  34 " })
    ).toEqual({ scheme: "REGISTRATION_NUMBER", value: "12  34" })
  })
  it.each([
    [{ scheme: "TICKER", value: "PETR4" }],
    [{ scheme: "ISIN", value: "BR123", market: "B3" }],
    [{ scheme: "OTHER", value: "" }],
  ] as const)("rejects structurally invalid identifier %#", (identifier) => {
    expect(() => instrumentIdentifier(identifier)).toThrowError(
      expect.objectContaining({ code: "INVALID_INVESTMENT_INPUT" })
    )
  })
  it("rejects a duplicate normalized identifier", () => {
    expect(() =>
      InvestmentInstrument.create(
        input({
          identifiers: [
            { scheme: "ISIN", value: " br123 " },
            { scheme: "ISIN", value: "BR123" },
          ],
        })
      )
    ).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_INSTRUMENT_IDENTIFIER" })
    )
  })
  it("updates mutable metadata once and records its fact", () => {
    const instrument = InvestmentInstrument.create(input())
    instrument.pullDomainFacts()
    instrument.updateMetadata({
      name: "Novo CDB",
      issuerName: " Banco ",
      identifiers: [],
    })
    expect(instrument.toSnapshot()).toMatchObject({
      name: "Novo CDB",
      issuerName: "Banco",
      version: 1,
    })
    expect(instrument.pullDomainFacts()).toHaveLength(1)
  })
  it("keeps no-op metadata updates version and facts unchanged", () => {
    const instrument = InvestmentInstrument.create(input())
    instrument.pullDomainFacts()
    instrument.updateMetadata({ name: "CDB Banco ABC", identifiers: [] })
    expect(instrument.version).toBe(0)
    expect(instrument.pullDomainFacts()).toEqual([])
  })
  it("rejects a type change after a historical position", () => {
    const instrument = InvestmentInstrument.create(input())
    expect(() => instrument.updateType("RDB", true)).toThrowError(
      expect.objectContaining({ code: "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE" })
    )
  })
  it("allows a type change before a historical position", () => {
    const instrument = InvestmentInstrument.create(input())
    instrument.updateType("RDB", false)
    expect(instrument.type).toBe("RDB")
  })
  it("refuses archiving with an open position", () => {
    const instrument = InvestmentInstrument.create(input())
    expect(() => instrument.archive(true)).toThrowError(
      expect.objectContaining({ code: "INVESTMENT_INSTRUMENT_IN_USE" })
    )
  })
  it("archives and reactivates with one versioned fact each", () => {
    const instrument = InvestmentInstrument.create(input())
    instrument.pullDomainFacts()
    instrument.archive(false)
    expect(instrument.status).toBe("ARCHIVED")
    expect(instrument.pullDomainFacts()[0]?.type).toBe(
      "InvestmentInstrumentArchived"
    )
    instrument.reactivate()
    expect(instrument.status).toBe("ACTIVE")
  })
  it("restores without domain facts and clones identifiers", () => {
    const created = InvestmentInstrument.create(
      input({ identifiers: [{ scheme: "TICKER", value: "cdb", market: "b3" }] })
    )
    const restored = InvestmentInstrument.restore(created.toSnapshot())
    const snapshot = restored.toSnapshot()
    expect(restored.pullDomainFacts()).toEqual([])
    expect(snapshot.identifiers).toEqual([
      { scheme: "TICKER", value: "CDB", market: "B3" },
    ])
    expect(snapshot.identifiers).not.toBe(created.toSnapshot().identifiers)
  })
  it("rejects names and issuer text outside normative bounds", () => {
    expect(() => InvestmentInstrument.create(input({ name: " " }))).toThrow(
      DomainError
    )
    expect(() =>
      InvestmentInstrument.create(input({ issuerName: "x".repeat(121) }))
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_INVESTMENT_INPUT" })
    )
  })
})
