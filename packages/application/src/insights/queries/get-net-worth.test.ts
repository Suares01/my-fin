import { Result } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InsightQueries,
} from "../../ports/index.js"
import { describe, expect, it, vi } from "vitest"
import { GetNetWorth } from "./get-net-worth.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    getNetWorth: vi.fn().mockResolvedValue({}),
  } as unknown as InsightQueries
  return { execute: new GetNetWorth(books, queries), books, queries }
}

describe("GetNetWorth", () => {
  it("validates the book and forwards an optional date", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getNetWorth).mockResolvedValue({
      assetMinor: "100",
      liabilityMinor: "40",
      netWorthMinor: "60",
      currency: "BRL",
      asOf: "2026-08-01",
    })

    const result = await execute.execute({
      bookId: "book-1",
      asOf: "2026-08-01",
    })

    expect(result).toEqual(
      Result.ok(expect.objectContaining({ netWorthMinor: "60" }))
    )
    expect(queries.getNetWorth).toHaveBeenCalledWith({
      bookId: "book-1",
      asOf: expect.objectContaining({ value: "2026-08-01" }),
    })
  })

  it.each([
    ["empty book", { bookId: "" }],
    ["bad date", { bookId: "book-1", asOf: "2026-02-30" }],
  ])("rejects %s before the adapter", async (_label, input) => {
    const { execute, books, queries } = handler()
    const result = await execute.execute(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.getNetWorth).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for an unknown book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "book-2" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.getNetWorth).not.toHaveBeenCalled()
  })

  it("sanitizes adapter failures", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getNetWorth).mockRejectedValue(
      new Error("SQL /private/ledger.sqlite")
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
