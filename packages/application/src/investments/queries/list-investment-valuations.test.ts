import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import { ListInvestmentValuations } from "./list-investment-valuations.js"
describe("ListInvestmentValuations", () =>
  it("validates ids and defaults page", async () => {
    const queries = {
      listValuations: vi
        .fn()
        .mockResolvedValue({ items: [], nextCursor: null }),
    }
    const execute = new ListInvestmentValuations(
      { findById: vi.fn().mockResolvedValue({}) } as never,
      queries as never
    )
    await expect(
      execute.execute({ bookId: "b", positionId: "p" })
    ).resolves.toEqual(Result.ok({ items: [], nextCursor: null }))
    expect(queries.listValuations).toHaveBeenCalledWith({
      bookId: "b",
      positionId: "p",
      limit: 25,
    })
  }))
