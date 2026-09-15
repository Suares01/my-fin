import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import { ListInvestmentPositions } from "./list-investment-positions.js"
describe("ListInvestmentPositions", () => {
  it("validates book and defaults limit/status before querying", async () => {
    const queries = {
      listPositions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    }
    const execute = new ListInvestmentPositions(
      { findById: vi.fn().mockResolvedValue({}) } as never,
      queries as never
    )
    await expect(
      execute.execute({ bookId: "book", search: "x" })
    ).resolves.toEqual(Result.ok({ items: [], nextCursor: null }))
    expect(queries.listPositions).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book",
        limit: 25,
        status: "OPEN",
        search: "x",
      })
    )
  })
  it("rejects invalid limits and unknown books", async () => {
    const queries = { listPositions: vi.fn() }
    const books = { findById: vi.fn().mockResolvedValue(null) }
    const execute = new ListInvestmentPositions(
      books as never,
      queries as never
    )
    await expect(
      execute.execute({ bookId: "book", limit: 101 })
    ).resolves.toMatchObject({ ok: false })
    await expect(execute.execute({ bookId: "book" })).resolves.toMatchObject({
      ok: false,
    })
  })
})
