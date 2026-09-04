import { ApplicationError } from "../ports/errors.js"
import { describe, expect, it } from "vitest"
import { normalizeJournalChainFilters } from "./journal-chain-filters.js"

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected an ApplicationError")
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApplicationError)
    expect((error as ApplicationError).code).toBe("INVALID_QUERY")
  }
}

describe("journal chain filter normalization", () => {
  it("canonicalizes an explicit inclusive period", () => {
    const filters = normalizeJournalChainFilters({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-31",
    })

    expect(filters.from?.value).toBe("2026-08-01")
    expect(filters.to?.value).toBe("2026-08-31")
  })

  it("normalizes the supported non-period filters", () => {
    expect(
      normalizeJournalChainFilters({
        bookId: "book-1",
        accountIds: [" account-2 ", "account-1", "account-2"],
        categoryIds: ["category-2", "category-1", "category-1"],
        types: ["TRANSFER", "EXPENSE", "TRANSFER"],
        origins: ["SYSTEM", "MANUAL", "SYSTEM"],
        search: "  CAFÉ  ",
      })
    ).toMatchObject({
      accountIds: ["account-1", "account-2"],
      categoryIds: ["category-1", "category-2"],
      types: ["EXPENSE", "TRANSFER"],
      origins: ["MANUAL", "SYSTEM"],
      search: "café",
    })
  })

  it.each([
    ["invalid from date", { from: "2026-02-30", to: "2026-02-30" }],
    ["invalid to date", { from: "2026-02-01", to: "2026-02-30" }],
    ["inverted date range", { from: "2026-08-05", to: "2026-08-04" }],
    ["only lower boundary", { from: "2026-08-01" }],
    ["only upper boundary", { to: "2026-08-31" }],
    ["empty account IDs", { accountIds: [] }],
    ["empty category IDs", { categoryIds: [] }],
    ["empty types", { types: [] }],
    ["invalid origin", { origins: ["IMPORT"] }],
    ["blank search", { search: "   " }],
  ])("rejects %s", (_label, input) => {
    expectInvalid(() => normalizeJournalChainFilters({ bookId: "book-1", ...input }))
  })
})
