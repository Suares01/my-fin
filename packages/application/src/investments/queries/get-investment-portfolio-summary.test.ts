import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import type {
  FinancialBookRepository,
  InvestmentPortfolioSummaryQueries,
} from "../../ports/index.js"
import type { Clock } from "../../ports/time.js"
import { GetInvestmentPortfolioSummary } from "./get-investment-portfolio-summary.js"

const summary = {
  bookId: "book-1",
  currency: "BRL",
  asOf: "2026-09-15",
  availableMinor: "100",
  otherAssetsMinor: "0",
  archivedDailyAccountBalanceMinor: "0",
  bookNetWorthMinor: "100",
  marketNetWorthMinor: "100",
  investmentLedgerMinor: "0",
  positionCostMinor: "0",
  investmentCashMinor: "0",
  investmentMarketValueMinor: "0",
  unrealizedResultMinor: "0",
  openPositionCount: 0,
  valuedPositionCount: 0,
  valuationDateRange: null,
  warnings: [],
} as const

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({
      baseCurrency: { code: "BRL" },
      timezone: "America/Sao_Paulo",
    }),
  } as unknown as FinancialBookRepository
  const queries = {
    getPortfolioSummary: vi.fn().mockResolvedValue(summary),
  } as unknown as InvestmentPortfolioSummaryQueries
  const clock = {
    localDate: vi.fn().mockReturnValue("2026-09-15"),
  } as unknown as Clock
  return {
    execute: new GetInvestmentPortfolioSummary(books, queries, clock),
    books,
    queries,
    clock,
  }
}

describe("GetInvestmentPortfolioSummary", () => {
  it("resolves the book date once and forwards currency and date to the read model", async () => {
    const { execute, clock, queries } = handler()

    await expect(execute.execute({ bookId: "book-1" })).resolves.toEqual(
      Result.ok(summary)
    )
    expect(clock.localDate).toHaveBeenCalledTimes(1)
    expect(clock.localDate).toHaveBeenCalledWith("America/Sao_Paulo")
    expect(queries.getPortfolioSummary).toHaveBeenCalledWith({
      bookId: "book-1",
      currency: "BRL",
      asOf: "2026-09-15",
    })
  })

  it("uses the active book currency and timezone rather than a fallback", async () => {
    const { execute, books, clock, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue({
      baseCurrency: { code: "USD" },
      timezone: "America/New_York",
    } as never)
    vi.mocked(clock.localDate).mockReturnValue("2026-09-14")

    await execute.execute({ bookId: "book-1" })

    expect(clock.localDate).toHaveBeenCalledWith("America/New_York")
    expect(queries.getPortfolioSummary).toHaveBeenCalledWith({
      bookId: "book-1",
      currency: "USD",
      asOf: "2026-09-14",
    })
  })

  it("rejects an invalid book id before accessing the clock or adapter", async () => {
    const { execute, books, clock, queries } = handler()

    const result = await execute.execute({ bookId: "" })

    expect(result).toEqual(
      Result.fail(expect.objectContaining({ code: "INVALID_QUERY" }))
    )
    expect(books.findById).not.toHaveBeenCalled()
    expect(clock.localDate).not.toHaveBeenCalled()
    expect(queries.getPortfolioSummary).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND without reading a date for a missing book", async () => {
    const { execute, books, clock, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "missing" })

    expect(result).toEqual(
      Result.fail(expect.objectContaining({ code: "ENTITY_NOT_FOUND" }))
    )
    expect(clock.localDate).not.toHaveBeenCalled()
    expect(queries.getPortfolioSummary).not.toHaveBeenCalled()
  })

  it("sanitizes adapter failures", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getPortfolioSummary).mockRejectedValue(
      new Error("private SQLite detail")
    )

    await expect(execute.execute({ bookId: "book-1" })).resolves.toEqual(
      Result.fail(
        expect.objectContaining({
          code: "UNEXPECTED_ERROR",
          message: "Financial query failed",
        })
      )
    )
  })
})
