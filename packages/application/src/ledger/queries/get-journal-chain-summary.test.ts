import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import type {
  FinancialBookRepository,
  JournalViewQueries,
} from "../../ports/index.js"
import { GetJournalChainSummary } from "./get-journal-chain-summary.js"

const summary = {
  incomeMinor: "2500",
  expenseMinor: "700",
  largestTransactionMinor: "2500",
  transactionCount: 3,
  currency: "BRL",
}

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    getJournalChainSummary: vi.fn().mockResolvedValue(summary),
  } as unknown as JournalViewQueries
  return { execute: new GetJournalChainSummary(books, queries), books, queries }
}

describe("GetJournalChainSummary", () => {
  it("returns the exact adapter summary and forwards normalized filters", async () => {
    const { execute, queries } = handler()

    const result = await execute.execute({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-31",
      accountIds: [" account-2 ", "account-1", "account-2"],
      categoryIds: ["category-1"],
      types: ["TRANSFER", "EXPENSE", "TRANSFER"],
      origins: ["MANUAL"],
      search: " CAFÉ ",
      status: "CANCELLED",
    })

    expect(result).toEqual(Result.ok(summary))
    expect(queries.getJournalChainSummary).toHaveBeenCalledWith({
      bookId: "book-1",
      from: expect.objectContaining({ value: "2026-08-01" }),
      to: expect.objectContaining({ value: "2026-08-31" }),
      accountIds: ["account-1", "account-2"],
      categoryIds: ["category-1"],
      types: ["EXPENSE", "TRANSFER"],
      origins: ["MANUAL"],
      search: "café",
      status: "CANCELLED",
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
    ["bad status", { status: "ALL" }],
  ])("rejects %s before accessing either port", async (_label, input) => {
    const { execute, books, queries } = handler()

    const result = await execute.execute({ bookId: "book-1", ...input })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.getJournalChainSummary).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for a missing book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "book-2" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.getJournalChainSummary).not.toHaveBeenCalled()
  })

  it("sanitizes failures from the product query", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getJournalChainSummary).mockRejectedValue(
      new Error("SQL SELECT secret /book/private.sqlite")
    )

    const result = await execute.execute({ bookId: "book-1" })

    expect(result).toEqual(
      Result.fail(
        expect.objectContaining({
          code: "UNEXPECTED_ERROR",
          message: "Financial query failed",
        })
      )
    )
  })
})
