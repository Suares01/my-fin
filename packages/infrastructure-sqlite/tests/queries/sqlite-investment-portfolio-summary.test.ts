import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentPortfolioSummary } from "../../src/queries/investments/sqlite-investment-portfolio-summary.js"
import { SqliteInvestmentAccountQueries } from "../../src/queries/investments/sqlite-investment-account-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type Account = {
  readonly id: string
  readonly kind?: "ASSET" | "LIABILITY"
  readonly status?: "ACTIVE" | "ARCHIVED"
  readonly type?:
    | "BANK_ACCOUNT"
    | "CASH"
    | "OTHER_ASSET"
    | "INVESTMENT_ACCOUNT"
    | "CREDIT_CARD"
}

describe("SqliteInvestmentPortfolioSummary", () => {
  let database: BetterSqliteDatabase
  let queries: SqliteInvestmentPortfolioSummary
  let accountQueries: SqliteInvestmentAccountQueries

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
      ["book-1", "Book", "BRL", "America/Sao_Paulo", 0]
    )
    queries = new SqliteInvestmentPortfolioSummary(database)
    accountQueries = new SqliteInvestmentAccountQueries(database)
  })
  afterEach(async () => database.close())

  it("returns the book currency and zero exact values for an empty book", async () => {
    await expect(summary()).resolves.toEqual({
      bookId: "book-1",
      currency: "BRL",
      asOf: "2026-08-04",
      availableMinor: "0",
      otherAssetsMinor: "0",
      archivedDailyAccountBalanceMinor: "0",
      bookNetWorthMinor: "0",
      marketNetWorthMinor: "0",
      investmentLedgerMinor: "0",
      positionCostMinor: "0",
      investmentCashMinor: "0",
      investmentMarketValueMinor: "0",
      unrealizedResultMinor: "0",
      openPositionCount: 0,
      valuedPositionCount: 0,
      valuationDateRange: null,
      warnings: [],
    })
  })

  it("includes active daily money but excludes archived daily money from available", async () => {
    await account({ id: "bank", type: "BANK_ACCOUNT" })
    await account({ id: "old-cash", type: "CASH", status: "ARCHIVED" })
    await posting("bank", "100")
    await posting("old-cash", "40")

    await expect(summary()).resolves.toMatchObject({
      availableMinor: "100",
      archivedDailyAccountBalanceMinor: "40",
      bookNetWorthMinor: "140",
    })
  })

  it("keeps other assets outside available while retaining them in accounting net worth", async () => {
    await account({ id: "other", type: "OTHER_ASSET" })
    await posting("other", "75")

    await expect(summary()).resolves.toMatchObject({
      availableMinor: "0",
      otherAssetsMinor: "75",
      bookNetWorthMinor: "75",
    })
  })

  it("subtracts liabilities using their normal balance", async () => {
    await account({ id: "bank", type: "BANK_ACCOUNT" })
    await account({ id: "card", kind: "LIABILITY", type: "CREDIT_CARD" })
    await posting("bank", "100")
    await posting("card", "-40")

    await expect(summary()).resolves.toMatchObject({ bookNetWorthMinor: "60" })
  })

  it("uses only postings at or before the explicit reference date", async () => {
    await account({ id: "bank", type: "BANK_ACCOUNT" })
    await posting("bank", "100", "2026-08-04")
    await posting("bank", "900", "2026-08-05")

    await expect(summary()).resolves.toMatchObject({ availableMinor: "100" })
  })

  it("uses exact bigint accumulation beyond int64-safe JavaScript numbers", async () => {
    await account({ id: "bank", type: "BANK_ACCOUNT" })
    await posting("bank", "9007199254740993")
    await posting("bank", "7")

    await expect(summary()).resolves.toMatchObject({
      availableMinor: "9007199254741000",
    })
  })

  it("uses current valuation gross value and calculates market net worth", async () => {
    await investmentAccount("broker")
    await position({ id: "position-1", accountId: "broker", cost: "1000" })
    await valuation({ positionId: "position-1", gross: "1200" })

    await expect(summary()).resolves.toMatchObject({
      positionCostMinor: "1000",
      investmentMarketValueMinor: "1200",
      unrealizedResultMinor: "200",
      marketNetWorthMinor: "200",
      valuedPositionCount: 1,
      valuationDateRange: { oldest: "2026-08-04", newest: "2026-08-04" },
    })
  })

  it("falls back to cost when the current allocation revision has no valuation", async () => {
    await investmentAccount("broker")
    await position({
      id: "position-1",
      accountId: "broker",
      cost: "1000",
      revision: 2,
    })
    await valuation({ positionId: "position-1", gross: "1200", revision: 1 })

    await expect(summary()).resolves.toMatchObject({
      investmentMarketValueMinor: "1000",
      unrealizedResultMinor: "0",
      valuedPositionCount: 0,
      valuationDateRange: null,
    })
  })

  it("ignores a valuation dated after the requested portfolio date", async () => {
    await investmentAccount("broker")
    await position({ id: "position-1", accountId: "broker", cost: "1000" })
    await valuation({
      positionId: "position-1",
      gross: "1200",
      valuedOn: "2026-08-05",
    })

    await expect(summary()).resolves.toMatchObject({
      investmentMarketValueMinor: "1000",
      valuedPositionCount: 0,
    })
  })

  it("chooses the highest valuedAt, recordedAt and persisted sequence tuple", async () => {
    await investmentAccount("broker")
    await position({ id: "position-1", accountId: "broker", cost: "1000" })
    await valuation({
      id: "v1",
      positionId: "position-1",
      gross: "1100",
      sequence: 1,
    })
    await valuation({
      id: "v2",
      positionId: "position-1",
      gross: "1200",
      sequence: 2,
    })

    await expect(summary()).resolves.toMatchObject({
      investmentMarketValueMinor: "1200",
    })
  })

  it("preserves negative investment cash and returns a warning for its account", async () => {
    await investmentAccount("broker")
    await position({ id: "position-1", accountId: "broker", cost: "1000" })

    await expect(summary()).resolves.toMatchObject({
      investmentCashMinor: "-1000",
      warnings: [
        {
          code: "INVESTMENT_CASH_NEGATIVE",
          investmentAccountId: "broker",
          cashMinor: "-1000",
          currency: "BRL",
          asOf: "2026-08-04",
        },
      ],
    })
  })

  it("warns separately for an investment account without an open position", async () => {
    await investmentAccount("broker")
    await posting("broker", "-1")

    await expect(summary()).resolves.toMatchObject({
      investmentCashMinor: "-1",
      warnings: [
        expect.objectContaining({
          investmentAccountId: "broker",
          cashMinor: "-1",
        }),
      ],
    })
  })

  it("keeps an archived investment account in accounting and market totals", async () => {
    await investmentAccount("broker", "ARCHIVED")
    await posting("broker", "1000")
    await position({ id: "position-1", accountId: "broker", cost: "1000" })
    await valuation({ positionId: "position-1", gross: "1200" })

    await expect(summary()).resolves.toMatchObject({
      investmentLedgerMinor: "1000",
      marketNetWorthMinor: "1200",
    })
  })

  it("reports the oldest and newest dates used by current valuations", async () => {
    await investmentAccount("broker")
    await position({ id: "position-1", accountId: "broker", cost: "1000" })
    await position({ id: "position-2", accountId: "broker", cost: "2000" })
    await valuation({
      id: "v1",
      positionId: "position-1",
      gross: "1100",
      valuedOn: "2026-08-03",
      sequence: 1,
    })
    await valuation({
      id: "v2",
      positionId: "position-2",
      gross: "2200",
      valuedOn: "2026-08-04",
      sequence: 2,
    })

    await expect(summary()).resolves.toMatchObject({
      valuedPositionCount: 2,
      valuationDateRange: { oldest: "2026-08-03", newest: "2026-08-04" },
    })
  })

  it("does not value a closed position even when it has historical valuations", async () => {
    await investmentAccount("broker")
    await position({
      id: "position-1",
      accountId: "broker",
      cost: "0",
      status: "CLOSED",
    })
    await valuation({ positionId: "position-1", gross: "1200" })

    await expect(summary()).resolves.toMatchObject({
      openPositionCount: 0,
      investmentMarketValueMinor: "0",
      valuedPositionCount: 0,
    })
  })

  it("lists an empty investment account set", async () => {
    await expect(accounts()).resolves.toEqual([])
  })

  it("lists account metadata in deterministic name order", async () => {
    await investmentAccount("zulu")
    await investmentAccount("alpha")
    await expect(accounts()).resolves.toMatchObject([
      { id: "alpha" },
      { id: "zulu" },
    ])
  })

  it("preserves an absent settlement account", async () => {
    await investmentAccount("broker")
    await expect(accounts()).resolves.toMatchObject([{ id: "broker" }])
    expect((await accounts())[0]).not.toHaveProperty(
      "defaultSettlementAccountId"
    )
  })

  it("keeps archived accounts in the list", async () => {
    await investmentAccount("broker", "ARCHIVED")
    await expect(accounts()).resolves.toMatchObject([{ status: "ARCHIVED" }])
  })

  it("calculates ledger, cost, cash and market values", async () => {
    await investmentAccount("broker")
    await posting("broker", "1000")
    await position({ id: "position-1", accountId: "broker", cost: "700" })
    await valuation({ positionId: "position-1", gross: "900" })
    await expect(accounts()).resolves.toMatchObject([
      {
        ledgerBalanceMinor: "1000",
        positionCostMinor: "700",
        cashMinor: "300",
        marketValueMinor: "1200",
        unrealizedResultMinor: "200",
      },
    ])
  })

  it("falls back to cost without a current valuation", async () => {
    await investmentAccount("broker")
    await position({ id: "position-1", accountId: "broker", cost: "700" })
    await expect(accounts()).resolves.toMatchObject([
      { marketValueMinor: "0", unrealizedResultMinor: "0" },
    ])
  })

  it("does not include closed position cost", async () => {
    await investmentAccount("broker")
    await position({
      id: "position-1",
      accountId: "broker",
      cost: "700",
      status: "CLOSED",
    })
    await expect(accounts()).resolves.toMatchObject([
      { positionCostMinor: "0" },
    ])
  })

  it("keeps the explicit query currency", async () => {
    await investmentAccount("broker")
    await expect(
      accountQueries.listInvestmentAccounts({
        bookId: "book-1",
        currency: "USD",
        asOf: "2026-08-04",
      })
    ).resolves.toMatchObject([{ currency: "USD" }])
  })

  it("returns detail counts without operation history", async () => {
    await investmentAccount("broker")
    await position({ id: "open", accountId: "broker", cost: "1" })
    await position({
      id: "closed",
      accountId: "broker",
      cost: "0",
      status: "CLOSED",
    })
    await expect(detail("broker")).resolves.toMatchObject({
      positionCount: 2,
      openPositionCount: 1,
    })
  })

  it("returns a signed-cash warning on account detail", async () => {
    await investmentAccount("broker")
    await posting("broker", "-1")
    await expect(detail("broker")).resolves.toMatchObject({
      warnings: [expect.objectContaining({ cashMinor: "-1", currency: "BRL" })],
    })
  })

  function summary() {
    return queries.getPortfolioSummary({
      bookId: "book-1",
      currency: "BRL",
      asOf: "2026-08-04",
    })
  }
  function accounts() {
    return accountQueries.listInvestmentAccounts({
      bookId: "book-1",
      currency: "BRL",
      asOf: "2026-08-04",
    })
  }
  function detail(accountId: string) {
    return accountQueries.getInvestmentAccountDetail({
      bookId: "book-1",
      accountId,
      currency: "BRL",
      asOf: "2026-08-04",
    })
  }
  async function account(input: Account) {
    const kind = input.kind ?? "ASSET"
    const status = input.status ?? "ACTIVE"
    await database.execute(
      "INSERT INTO ledger_accounts (id, book_id, name, normalized_name, kind, status, system_purpose, version) VALUES (?, 'book-1', ?, ?, ?, ?, NULL, 0)",
      [input.id, input.id, input.id, kind, status]
    )
    await database.execute(
      "INSERT INTO financial_accounts (ledger_account_id, book_id, type) VALUES (?, 'book-1', ?)",
      [
        input.id,
        input.type === "BANK_ACCOUNT" ? "BANK" : (input.type ?? "OTHER_ASSET"),
      ]
    )
  }
  async function investmentAccount(
    id: string,
    status: "ACTIVE" | "ARCHIVED" = "ACTIVE"
  ) {
    await account({ id, status, type: "INVESTMENT_ACCOUNT" })
    await database.execute(
      "INSERT INTO investment_accounts (ledger_account_id, book_id, default_settlement_account_id) VALUES (?, 'book-1', NULL)",
      [id]
    )
  }
  async function position(input: {
    id: string
    accountId: string
    cost: string
    revision?: number
    status?: "OPEN" | "CLOSED"
  }) {
    const status = input.status ?? "OPEN"
    await database.execute(
      "INSERT INTO investment_instruments (id, book_id, name, normalized_name, type, currency, issuer_name, status, version) VALUES (?, 'book-1', ?, ?, 'CDB', 'BRL', NULL, 'ACTIVE', 0)",
      [`instrument-${input.id}`, input.id, input.id]
    )
    await database.execute(
      "INSERT INTO investment_positions (id, book_id, investment_account_id, instrument_id, label, normalized_label, quantity_mode, quantity, book_cost_minor, currency, opened_on, closed_on, status, allocation_revision, allocation_effective_on, version) VALUES (?, 'book-1', ?, ?, NULL, '', 'AMOUNT', NULL, ?, 'BRL', '2026-08-01', ?, ?, ?, '2026-08-01', 0)",
      [
        input.id,
        input.accountId,
        `instrument-${input.id}`,
        input.cost,
        status === "CLOSED" ? "2026-08-04" : null,
        status,
        input.revision ?? 1,
      ]
    )
  }
  async function valuation(input: {
    id?: string
    positionId: string
    gross: string
    revision?: number
    sequence?: number
    valuedOn?: string
  }) {
    const sequence = input.sequence ?? 1
    await database.execute(
      "INSERT INTO investment_valuations (id, book_id, position_id, allocation_revision, valued_at, valued_on, recorded_at, record_sequence, source, quantity, unit_price, currency, gross_value_minor, net_value_minor, withdrawable_value_minor) VALUES (?, 'book-1', ?, ?, '2026-08-04T10:00:00.000Z', ?, '2026-08-04T11:00:00.000Z', ?, 'MANUAL', NULL, NULL, 'BRL', ?, NULL, NULL)",
      [
        input.id ?? `valuation-${sequence}`,
        input.positionId,
        input.revision ?? 1,
        input.valuedOn ?? "2026-08-04",
        sequence,
        input.gross,
      ]
    )
  }
  async function posting(
    accountId: string,
    amount: string,
    occurredOn = "2026-08-04"
  ) {
    const entryId = `entry-${accountId}-${occurredOn}-${amount}`
    await database.execute(
      "INSERT INTO journal_entries (id, book_id, occurred_on, recorded_at, sequence, description, currency, origin, reversal_of_id, reversed_by_id, version) VALUES (?, 'book-1', ?, '2026-08-04T12:00:00.000Z', ?, 'seed', 'BRL', 'MANUAL', NULL, NULL, 0)",
      [
        entryId,
        occurredOn,
        String(Math.abs(Number(amount)) + occurredOn.length),
      ]
    )
    await database.execute(
      "INSERT INTO postings (id, book_id, journal_entry_id, account_id, position, amount_minor, currency) VALUES (?, 'book-1', ?, ?, 0, ?, 'BRL')",
      [`posting-${entryId}`, entryId, accountId, amount]
    )
  }
})
