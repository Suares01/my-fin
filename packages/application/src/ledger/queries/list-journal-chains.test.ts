import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import type {
  FinancialBookRepository,
  JournalViewQueries,
} from "../../ports/index.js"
import {
  encodeJournalChainCursor,
  journalChainFilterFingerprint,
  normalizeJournalChainFilters,
} from "../../querying/journal-chain-filters.js"
import { ListJournalChains } from "./list-journal-chains.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    listJournalChains: vi.fn().mockResolvedValue({ items: [], nextKey: null }),
  } as unknown as JournalViewQueries
  return { execute: new ListJournalChains(books, queries), books, queries }
}

const chain = {
  chainId: "root-1",
  presentedEntryId: "entry-1",
  presentedVersion: 2,
  type: "EXPENSE" as const,
  status: "EDITED" as const,
  occurredOn: "2026-08-04",
  recordedAt: "2026-08-04T12:00:00.000Z",
  sequence: "9007199254740993",
  description: "Groceries",
  origin: "MANUAL" as const,
  amountMinor: "-1000",
  currency: "BRL",
  financialAccounts: [],
  categories: [],
}

describe("ListJournalChains", () => {
  it("returns a page and encodes the consolidated cursor", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listJournalChains).mockResolvedValue({
      items: [chain],
      nextKey: {
        occurredOn: "2026-08-04",
        sequence: "9007199254740993",
        chainId: "root-1",
        filterFingerprint: journalChainFilterFingerprint(
          normalizeJournalChainFilters({ bookId: "book-1", limit: 10 })
        ),
      },
    })

    const result = await execute.execute({ bookId: "book-1", limit: 10 })

    expect(result).toEqual(
      Result.ok({
        items: [chain],
        nextCursor: encodeJournalChainCursor({
          occurredOn: "2026-08-04",
          sequence: "9007199254740993",
          chainId: "root-1",
          filterFingerprint: journalChainFilterFingerprint(
            normalizeJournalChainFilters({ bookId: "book-1", limit: 10 })
          ),
        }),
      })
    )
  })

  it("applies the default limit and book scope", async () => {
    const { execute, queries } = handler()

    const result = await execute.execute({ bookId: "book-1" })

    expect(result.ok).toBe(true)
    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith({
      bookId: "book-1",
      limit: 20,
    })
  })

  it("forwards every filter as normalized typed values", async () => {
    const { execute, queries } = handler()
    const cursorKey = {
      occurredOn: "2026-08-04",
      sequence: "9",
      chainId: "root-1",
      filterFingerprint: journalChainFilterFingerprint(
        normalizeJournalChainFilters({
          bookId: "book-1",
          from: "2026-08-01",
          to: "2026-08-04",
          accountIds: ["account-1"],
          categoryIds: ["category-1"],
          types: ["EXPENSE"],
          origins: ["MANUAL"],
          search: "salary",
          limit: 10,
        })
      ),
    }
    const cursor = encodeJournalChainCursor(cursorKey)

    const result = await execute.execute({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-04",
      accountIds: [" account-1 "],
      categoryIds: ["category-1"],
      types: ["EXPENSE"],
      origins: ["MANUAL"],
      search: " SALARY ",
      limit: 10,
      cursor,
    })

    expect(result.ok).toBe(true)
    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith({
      bookId: "book-1",
      from: expect.objectContaining({ value: "2026-08-01" }),
      to: expect.objectContaining({ value: "2026-08-04" }),
      accountIds: ["account-1"],
      categoryIds: ["category-1"],
      types: ["EXPENSE"],
      origins: ["MANUAL"],
      search: "salary",
      limit: 10,
      cursor: cursorKey,
    })
  })

  it("deduplicates equivalent filter groups before the product port", async () => {
    const { execute, queries } = handler()

    await execute.execute({
      bookId: "book-1",
      accountIds: ["account-2", "account-1", "account-2"],
      categoryIds: ["category-2", "category-1", "category-1"],
      types: ["TRANSFER", "EXPENSE", "TRANSFER"],
      origins: ["SYSTEM", "MANUAL", "SYSTEM"],
      limit: 10,
    })

    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith({
      bookId: "book-1",
      accountIds: ["account-1", "account-2"],
      categoryIds: ["category-1", "category-2"],
      types: ["EXPENSE", "TRANSFER"],
      origins: ["MANUAL", "SYSTEM"],
      limit: 10,
    })
  })

  it.each([
    ["bad book", { bookId: " " }],
    ["bad date", { from: "2026-02-30" }],
    ["bad account", { accountIds: [] }],
    ["bad category", { categoryIds: [] }],
    ["bad type", { types: ["OTHER"] }],
    ["bad origin", { origins: ["IMPORT"] }],
    ["bad search", { search: "   " }],
    ["bad limit", { limit: 0 }],
  ])("rejects %s before accessing either port", async (_label, input) => {
    const { execute, books, queries } = handler()

    const result = await execute.execute({
      bookId: "book-1",
      limit: 10,
      ...input,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.listJournalChains).not.toHaveBeenCalled()
  })

  it("rejects a cursor bound to different filters before accessing the product port", async () => {
    const { execute, books, queries } = handler()
    const cursor = encodeJournalChainCursor({
      occurredOn: "2026-08-04",
      sequence: "1",
      chainId: "root-1",
      filterFingerprint: journalChainFilterFingerprint(
        normalizeJournalChainFilters({
          bookId: "book-1",
          search: "salary",
          limit: 10,
        })
      ),
    })

    const result = await execute.execute({
      bookId: "book-1",
      search: "rent",
      limit: 10,
      cursor,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.listJournalChains).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for a missing book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "book-2", limit: 10 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.listJournalChains).not.toHaveBeenCalled()
  })

  it("sanitizes failures from the product query", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listJournalChains).mockRejectedValue(
      new Error("SQL SELECT secret /book/private.sqlite")
    )

    const result = await execute.execute({ bookId: "book-1", limit: 10 })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
    }
  })

  it("returns an empty first page without a continuation", async () => {
    const { execute } = handler()

    await expect(
      execute.execute({ bookId: "book-1", limit: 10 })
    ).resolves.toEqual(Result.ok({ items: [], nextCursor: null }))
  })
})
