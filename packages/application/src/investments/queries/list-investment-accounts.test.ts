import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import type {
  FinancialBookRepository,
  InvestmentAccountQueries,
} from "../../ports/index.js"
import type { Clock } from "../../ports/time.js"
import { ListInvestmentAccounts } from "./list-investment-accounts.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({
      baseCurrency: { code: "BRL" },
      timezone: "America/Sao_Paulo",
    }),
  } as unknown as FinancialBookRepository
  const queries = {
    listInvestmentAccounts: vi.fn().mockResolvedValue([]),
  } as unknown as InvestmentAccountQueries
  const clock = {
    localDate: vi.fn().mockReturnValue("2026-08-04"),
  } as unknown as Clock
  return {
    execute: new ListInvestmentAccounts(books, queries, clock),
    books,
    queries,
    clock,
  }
}

describe("ListInvestmentAccounts", () => {
  it("passes the active book currency and one local date to the read model", async () => {
    const { execute, clock, queries } = handler()
    await expect(execute.execute({ bookId: "book-1" })).resolves.toEqual(
      Result.ok([])
    )
    expect(clock.localDate).toHaveBeenCalledTimes(1)
    expect(queries.listInvestmentAccounts).toHaveBeenCalledWith({
      bookId: "book-1",
      currency: "BRL",
      asOf: "2026-08-04",
    })
  })

  it("rejects an invalid or absent book before querying", async () => {
    const { execute, books, queries } = handler()
    await expect(execute.execute({ bookId: "" })).resolves.toEqual(
      Result.fail(expect.objectContaining({ code: "INVALID_QUERY" }))
    )
    vi.mocked(books.findById).mockResolvedValue(null)
    await expect(execute.execute({ bookId: "missing" })).resolves.toEqual(
      Result.fail(expect.objectContaining({ code: "ENTITY_NOT_FOUND" }))
    )
    expect(queries.listInvestmentAccounts).not.toHaveBeenCalled()
  })
})
