import { Result } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InsightQueries,
} from "../../ports/index.js"
import { describe, expect, it, vi } from "vitest"
import { GetMonthlyCashFlow } from "./get-monthly-cash-flow.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    getMonthlyCashFlow: vi.fn().mockResolvedValue([]),
  } as unknown as InsightQueries
  return { execute: new GetMonthlyCashFlow(books, queries), books, queries }
}

describe("GetMonthlyCashFlow", () => {
  it("validates months and returns the adapter read model", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getMonthlyCashFlow).mockResolvedValue([
      {
        month: "2026-08",
        incomeMinor: "100",
        expenseMinor: "40",
        netMinor: "60",
        currency: "BRL",
      },
    ])

    const result = await execute.execute({
      bookId: "book-1",
      fromMonth: "2026-08",
      toMonth: "2026-08",
    })

    expect(result).toEqual(
      Result.ok([expect.objectContaining({ month: "2026-08", netMinor: "60" })])
    )
    expect(queries.getMonthlyCashFlow).toHaveBeenCalledWith({
      bookId: "book-1",
      fromMonth: "2026-08",
      toMonth: "2026-08",
    })
  })

  it.each([
    ["bad month", { fromMonth: "2026-13", toMonth: "2026-08" }],
    ["inverted range", { fromMonth: "2026-09", toMonth: "2026-08" }],
    ["empty book id", { bookId: "", fromMonth: "2026-08", toMonth: "2026-08" }],
  ])("rejects %s without calling the adapter", async (_label, input) => {
    const { execute, books, queries } = handler()
    const invalidInput = input as Partial<{
      bookId: string
      fromMonth: string
      toMonth: string
    }>

    const request = {
      ...invalidInput,
      bookId: invalidInput.bookId ?? "book-1",
      fromMonth: invalidInput.fromMonth ?? "2026-08",
      toMonth: invalidInput.toMonth ?? "2026-08",
    }
    const result = await execute.execute(request)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.getMonthlyCashFlow).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for an unknown book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({
      bookId: "book-2",
      fromMonth: "2026-08",
      toMonth: "2026-08",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.getMonthlyCashFlow).not.toHaveBeenCalled()
  })

  it("sanitizes indicator failures", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getMonthlyCashFlow).mockRejectedValue(
      new Error("SQL /private/ledger.sqlite")
    )

    const result = await execute.execute({
      bookId: "book-1",
      fromMonth: "2026-08",
      toMonth: "2026-08",
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
