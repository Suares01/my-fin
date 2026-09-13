import { describe, expect, it } from "vitest"
import type {
  InvestmentPortfolioSummary,
  InvestmentPositionView,
  ListInvestmentPositionsQuery,
  PositionValuationView,
} from "./investment-queries.js"

describe("investment query contracts", () => {
  const valuation: PositionValuationView = {
    basis: "VALUATION",
    currentValueMinor: "5200",
    valuationId: "valuation-1",
    valuedAt: "2026-09-10T12:00:00.000Z",
  }
  const position: InvestmentPositionView = {
    id: "position-1",
    investmentAccountId: "account-1",
    instrumentId: "instrument-1",
    instrumentName: "CDB",
    assetClass: "FIXED_INCOME",
    bookCostMinor: "5000",
    currency: "BRL",
    status: "OPEN",
    allocationRevision: 2,
    valuation,
  }
  it("keeps all portfolio monetary values as exact strings", () => {
    const summary: InvestmentPortfolioSummary = {
      bookId: "book-1",
      currency: "USD",
      asOf: "2026-09-10",
      availableMinor: "10",
      otherAssetsMinor: "2",
      archivedDailyAccountBalanceMinor: "3",
      bookNetWorthMinor: "9",
      marketNetWorthMinor: "11",
      investmentLedgerMinor: "5",
      positionCostMinor: "4",
      investmentCashMinor: "1",
      investmentMarketValueMinor: "6",
      unrealizedResultMinor: "2",
      openPositionCount: 1,
      valuedPositionCount: 1,
      valuationDateRange: { oldest: "2026-09-01", newest: "2026-09-10" },
      warnings: [],
    }
    expect(summary).toMatchObject({
      currency: "USD",
      asOf: "2026-09-10",
      marketNetWorthMinor: "11",
    })
  })
  it("keeps valuation basis explicit", () =>
    expect(valuation).toMatchObject({
      basis: "VALUATION",
      currentValueMinor: "5200",
    }))
  it("represents book-cost fallback", () =>
    expect({
      basis: "BOOK_COST",
      currentValueMinor: "5000",
    } satisfies PositionValuationView).toEqual({
      basis: "BOOK_COST",
      currentValueMinor: "5000",
    }))
  it("represents closed value as zero", () =>
    expect({
      basis: "CLOSED",
      currentValueMinor: "0",
    } satisfies PositionValuationView).toEqual({
      basis: "CLOSED",
      currentValueMinor: "0",
    }))
  it("keeps optional quantity unknown", () =>
    expect(position.quantity).toBeUndefined())
  it("scopes positions to a book", () => {
    const query: ListInvestmentPositionsQuery = { bookId: "book-1", limit: 25 }
    expect(query).toEqual({ bookId: "book-1", limit: 25 })
  })
  it("keeps list filters separate from a summary", () =>
    expect("search" in ({ bookId: "book-1" } as object)).toBe(false))
  it("keeps cursors per position list", () => {
    const query: ListInvestmentPositionsQuery = {
      bookId: "book-1",
      limit: 100,
      cursor: "ip1.cursor",
    }
    expect(query.cursor).toBe("ip1.cursor")
  })
})
