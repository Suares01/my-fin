import { Result } from "@workspace/domain"
import type {
  FinancialBookRepository,
  LedgerReadQueries,
} from "../../ports/index.js"
import { describe, expect, it, vi } from "vitest"
import { encodeJournalEntryCursor } from "../../querying/cursor-codec.js"
import { ListJournalEntries } from "./list-journal-entries.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    listJournalEntries: vi.fn().mockResolvedValue({ items: [], nextKey: null }),
  } as unknown as LedgerReadQueries
  return { execute: new ListJournalEntries(books, queries), books, queries }
}

describe("ListJournalEntries", () => {
  it("returns a page and encodes the journal cursor", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listJournalEntries).mockResolvedValue({
      items: [
        {
          id: "entry-1",
          occurredOn: "2026-08-04",
          recordedAt: "2026-08-04T12:00:00.000Z",
          sequence: "10",
          description: "Salary",
          origin: "MANUAL",
          financialAccounts: [],
          categories: [],
          incomeMinor: "100",
          expenseMinor: "0",
          transferMinor: "0",
          currency: "BRL",
          isSplit: false,
          isReversal: false,
          isReversed: false,
        },
      ],
      nextKey: { occurredOn: "2026-08-04", sequence: "10" },
    })

    const result = await execute.execute({ bookId: "book-1", limit: 10 })

    expect(result).toEqual(
      Result.ok({
        items: [expect.objectContaining({ id: "entry-1", incomeMinor: "100" })],
        nextCursor: encodeJournalEntryCursor({
          occurredOn: "2026-08-04",
          sequence: "10",
        }),
      })
    )
  })

  it("validates and forwards all filters as typed values", async () => {
    const { execute, queries } = handler()
    const cursor = encodeJournalEntryCursor({
      occurredOn: "2026-08-04",
      sequence: "9",
    })

    const result = await execute.execute({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-04",
      accountIds: ["account-1"],
      categoryIds: ["category-1"],
      origins: ["MANUAL"],
      search: "  salary  ",
      limit: 10,
      cursor,
    })

    expect(result.ok).toBe(true)
    const call = vi.mocked(queries.listJournalEntries).mock.calls[0]?.[0]
    expect(call?.from?.value).toBe("2026-08-01")
    expect(call?.to?.value).toBe("2026-08-04")
    expect(call?.accountIds).toEqual(["account-1"])
    expect(call?.categoryIds).toEqual(["category-1"])
    expect(call?.origins).toEqual(["MANUAL"])
    expect(call?.search).toBe("salary")
    expect(call?.cursor).toEqual({ occurredOn: "2026-08-04", sequence: "9" })
  })

  it.each([
    ["empty account list", { accountIds: [] }],
    ["empty origin list", { origins: [] }],
    ["empty search", { search: "   " }],
    ["invalid cursor", { cursor: "s1.2026-08-04.1.0" }],
  ])("rejects %s before accessing the port", async (_label, input) => {
    const { execute, books, queries } = handler()

    const result = await execute.execute({
      bookId: "book-1",
      limit: 10,
      ...input,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.listJournalEntries).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for a missing book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "book-2", limit: 10 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.listJournalEntries).not.toHaveBeenCalled()
  })

  it("sanitizes failures from the global query", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listJournalEntries).mockRejectedValue(
      new Error("SQL SELECT secret /book/private.sqlite")
    )

    const result = await execute.execute({ bookId: "book-1", limit: 10 })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
    }
  })

  it("returns null when the adapter has no continuation", async () => {
    const { execute } = handler()

    await expect(
      execute.execute({ bookId: "book-1", limit: 10 })
    ).resolves.toEqual(Result.ok({ items: [], nextCursor: null }))
  })
})
