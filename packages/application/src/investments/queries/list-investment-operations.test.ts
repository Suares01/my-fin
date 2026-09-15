import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import { ListInvestmentOperations } from "./list-investment-operations.js"
describe("ListInvestmentOperations", () => {
  it("validates and defaults query", async () => {
    const queries = {
      listOperations: vi
        .fn()
        .mockResolvedValue({ items: [], nextCursor: null }),
    }
    const execute = new ListInvestmentOperations(
      { findById: vi.fn().mockResolvedValue({}) } as never,
      queries as never
    )
    await expect(
      execute.execute({ bookId: "b", positionId: "p" })
    ).resolves.toEqual(Result.ok({ items: [], nextCursor: null }))
    expect(queries.listOperations).toHaveBeenCalledWith({
      bookId: "b",
      positionId: "p",
      limit: 25,
    })
  })
  it("rejects absent book or position", async () => {
    const execute = new ListInvestmentOperations(
      { findById: vi.fn().mockResolvedValue(null) } as never,
      {} as never
    )
    await expect(
      execute.execute({ bookId: "", positionId: "p" })
    ).resolves.toMatchObject({ ok: false })
    await expect(
      execute.execute({ bookId: "b", positionId: "" })
    ).resolves.toMatchObject({ ok: false })
  })
})
