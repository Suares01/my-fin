import { ApplicationError } from "../ports/errors.js"
import { describe, expect, it } from "vitest"
import {
  decodeJournalChainCursor,
  encodeJournalChainCursor,
  journalChainFilterFingerprint,
  normalizeJournalChainFilters,
} from "./journal-chain-filters.js"

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected an ApplicationError")
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApplicationError)
    expect((error as ApplicationError).code).toBe("INVALID_QUERY")
  }
}

const baseQuery = {
  bookId: "book-1",
  limit: 10,
}

describe("journal chain filter normalization", () => {
  it("uses the default limit when omitted", () => {
    expect(normalizeJournalChainFilters({ bookId: "book-1" }).limit).toBe(20)
  })

  it("canonicalizes valid date boundaries", () => {
    const filters = normalizeJournalChainFilters({
      ...baseQuery,
      from: "2026-08-01",
      to: "2026-08-04",
    })
    expect(filters.from?.value).toBe("2026-08-01")
    expect(filters.to?.value).toBe("2026-08-04")
  })

  it("trims, deduplicates and sorts account IDs", () => {
    expect(
      normalizeJournalChainFilters({
        ...baseQuery,
        accountIds: [" account-2 ", "account-1", "account-2"],
      }).accountIds
    ).toEqual(["account-1", "account-2"])
  })

  it("trims, deduplicates and sorts category IDs", () => {
    expect(
      normalizeJournalChainFilters({
        ...baseQuery,
        categoryIds: ["category-2", "category-1", "category-1"],
      }).categoryIds
    ).toEqual(["category-1", "category-2"])
  })

  it("deduplicates and sorts business types", () => {
    expect(
      normalizeJournalChainFilters({
        ...baseQuery,
        types: ["TRANSFER", "EXPENSE", "TRANSFER"],
      }).types
    ).toEqual(["EXPENSE", "TRANSFER"])
  })

  it("deduplicates and sorts origins", () => {
    expect(
      normalizeJournalChainFilters({
        ...baseQuery,
        origins: ["SYSTEM", "MANUAL", "SYSTEM"],
      }).origins
    ).toEqual(["MANUAL", "SYSTEM"])
  })

  it("normalizes search by trimming, NFC and lowercase", () => {
    expect(
      normalizeJournalChainFilters({
        ...baseQuery,
        search: "  CAFÉ  ",
      }).search
    ).toBe("café")
  })

  it("preserves the distinction between accented and unaccented search", () => {
    const accented = normalizeJournalChainFilters({
      ...baseQuery,
      search: "café",
    }).search
    const unaccented = normalizeJournalChainFilters({
      ...baseQuery,
      search: "cafe",
    }).search
    expect(accented).not.toBe(unaccented)
  })

  it("creates the same fingerprint for equivalent filter order", () => {
    const first = normalizeJournalChainFilters({
      ...baseQuery,
      accountIds: ["account-2", "account-1"],
      types: ["TRANSFER", "EXPENSE"],
    })
    const second = normalizeJournalChainFilters({
      ...baseQuery,
      accountIds: ["account-1", "account-2"],
      types: ["EXPENSE", "TRANSFER"],
    })
    expect(journalChainFilterFingerprint(first)).toBe(
      journalChainFilterFingerprint(second)
    )
  })

  it("round-trips a jc1 cursor with an exact decimal sequence", () => {
    const key = {
      occurredOn: "2026-08-04",
      sequence: "9007199254740993",
      chainId: "root.with.dot",
      filterFingerprint: '{"search":"café"}',
    }
    expect(decodeJournalChainCursor(encodeJournalChainCursor(key))).toEqual(key)
  })

  it("emits the versioned jc1 cursor prefix", () => {
    expect(
      encodeJournalChainCursor({
        occurredOn: "2026-08-04",
        sequence: "1",
        chainId: "root",
        filterFingerprint: "{}",
      })
    ).toMatch(/^jc1\./)
  })

  it("accepts an unchanged cursor for normalized filters", () => {
    const filters = normalizeJournalChainFilters({
      ...baseQuery,
      search: " Salary ",
    })
    const cursor = encodeJournalChainCursor({
      occurredOn: "2026-08-04",
      sequence: "1",
      chainId: "root",
      filterFingerprint: journalChainFilterFingerprint(filters),
    })
    expect(
      normalizeJournalChainFilters({ ...baseQuery, search: "salary", cursor })
        .cursor
    ).toEqual({
      occurredOn: "2026-08-04",
      sequence: "1",
      chainId: "root",
      filterFingerprint: journalChainFilterFingerprint(filters),
    })
  })

  it.each([
    ["date", { from: "2026-08-02" }, { from: "2026-08-01" }],
    ["account", { accountIds: ["account-1"] }, { accountIds: ["account-2"] }],
    [
      "category",
      { categoryIds: ["category-1"] },
      { categoryIds: ["category-2"] },
    ],
    ["type", { types: ["EXPENSE"] }, { types: ["INCOME"] }],
    ["origin", { origins: ["MANUAL"] }, { origins: ["SYSTEM"] }],
    ["search", { search: "salary" }, { search: "rent" }],
  ])(
    "rejects a cursor when the %s filter changes",
    (_label, original, changed) => {
      const originalFilters = normalizeJournalChainFilters({
        ...baseQuery,
        ...original,
      })
      const cursor = encodeJournalChainCursor({
        occurredOn: "2026-08-04",
        sequence: "1",
        chainId: "root",
        filterFingerprint: journalChainFilterFingerprint(originalFilters),
      })
      expectInvalid(() =>
        normalizeJournalChainFilters({ ...baseQuery, ...changed, cursor })
      )
    }
  )
})

describe("journal chain filter rejection", () => {
  it.each([
    ["invalid from date", { from: "2026-02-30" }],
    ["invalid to date", { to: "2026-02-30" }],
    ["inverted date range", { from: "2026-08-05", to: "2026-08-04" }],
    ["empty account IDs", { accountIds: [] }],
    ["blank account ID", { accountIds: [" "] }],
    ["empty category IDs", { categoryIds: [] }],
    ["invalid type", { types: ["OTHER"] }],
    ["empty types", { types: [] }],
    ["invalid origin", { origins: ["IMPORT"] }],
    ["empty origins", { origins: [] }],
    ["blank search", { search: "   " }],
    ["zero limit", { limit: 0 }],
    ["large limit", { limit: 101 }],
    ["fractional limit", { limit: 1.5 }],
  ])("rejects %s", (_label, input) => {
    expectInvalid(() =>
      normalizeJournalChainFilters({ ...baseQuery, ...input })
    )
  })

  it.each([
    "j2.payload",
    "jc1.",
    "jc1.not-json",
    "jc1.%7B%22occurredOn%22%3A%222026-08-04%22%7D",
  ])("rejects malformed cursor %s", (cursor) => {
    expectInvalid(() => normalizeJournalChainFilters({ ...baseQuery, cursor }))
  })

  it("rejects a cursor with an invalid decimal sequence", () => {
    expectInvalid(() => decodeJournalChainCursor(encodeURIComponent("jc1")))
    expectInvalid(() =>
      decodeJournalChainCursor(
        "jc1.%7B%22occurredOn%22%3A%222026-08-04%22%2C%22sequence%22%3A%2201%22%2C%22chainId%22%3A%22root%22%2C%22filterFingerprint%22%3A%22%7B%7D%22%7D"
      )
    )
  })
})
