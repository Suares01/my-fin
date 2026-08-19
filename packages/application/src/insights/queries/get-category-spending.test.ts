import { Result } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InsightQueries,
} from "../../ports/index.js"
import { describe, expect, it, vi } from "vitest"
import { GetCategorySpending } from "./get-category-spending.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    getCategorySpending: vi.fn().mockResolvedValue([]),
  } as unknown as InsightQueries
  return { execute: new GetCategorySpending(books, queries), books, queries }
}

describe("GetCategorySpending", () => {
  it("validates the period and returns the adapter read model", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getCategorySpending).mockResolvedValue([
      {
        categoryId: "category-1",
        categoryName: "Food",
        amountMinor: "125",
        percentageBasisPoints: 10000,
        transactionCount: 2,
        archived: false,
      },
    ])

    const result = await execute.execute({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-31",
      categoryId: "category-1",
    })

    expect(result).toEqual(
      Result.ok([expect.objectContaining({ categoryName: "Food" })])
    )
    expect(queries.getCategorySpending).toHaveBeenCalledWith({
      bookId: "book-1",
      from: expect.objectContaining({ value: "2026-08-01" }),
      to: expect.objectContaining({ value: "2026-08-31" }),
      categoryId: "category-1",
    })
  })

  it.each([
    ["empty book", { bookId: "" }],
    ["missing from", { from: undefined }],
    ["inverted period", { from: "2026-09-01", to: "2026-08-31" }],
    ["empty category", { categoryId: "" }],
  ])("rejects %s before the adapter", async (_label, input) => {
    const { execute, books, queries } = handler()
    const invalidInput = input as Partial<{
      bookId: string
      from: string
      to: string
      categoryId: string
    }>
    const request = {
      bookId: invalidInput.bookId ?? "book-1",
      from:
        invalidInput.from === undefined && "from" in invalidInput
          ? undefined
          : (invalidInput.from ?? "2026-08-01"),
      to: invalidInput.to ?? "2026-08-31",
      ...(invalidInput.categoryId === undefined
        ? {}
        : { categoryId: invalidInput.categoryId }),
    } as never
    const result = await execute.execute(request)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.getCategorySpending).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for an unknown book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({
      bookId: "book-2",
      from: "2026-08-01",
      to: "2026-08-31",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.getCategorySpending).not.toHaveBeenCalled()
  })

  it("sanitizes adapter failures", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getCategorySpending).mockRejectedValue(
      new Error("SQL /private/ledger.sqlite")
    )

    const result = await execute.execute({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-31",
    })

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
