import Database from "better-sqlite3"
import { LocalDate } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SqliteInsightQueries } from "../../src/queries/sqlite-insight-queries.js"
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"
import {
  createFinancialQueryScenario,
  type FinancialQueryScenario,
} from "../support/financial-query-scenario.js"

const bookId = "book-1" as never

async function createScenario(database?: BetterSqliteDatabase): Promise<{
  readonly scenario: FinancialQueryScenario
  readonly cashId: string
  readonly foodId: string
}> {
  const scenario = await createFinancialQueryScenario(database)
  await scenario.createBook()
  const cashId = (await scenario.createFinancialAccount({ name: "Checking" }))
    .id
  const savingsId = (await scenario.createFinancialAccount({ name: "Savings" }))
    .id
  await scenario.createFinancialAccount({
    kind: "LIABILITY",
    name: "Card",
  })
  const foodId = (await scenario.createExpenseCategory("Food")).id
  const salaryId = (await scenario.createIncomeCategory("Salary")).id

  await scenario.setOpeningBalance({
    accountId: cashId,
    amountMinor: "1000",
    occurredOn: "2026-08-01",
  })
  await scenario.recordIncome({
    accountId: cashId,
    categoryId: salaryId,
    amountMinor: "100",
  })
  await scenario.recordExpense({
    accountId: cashId,
    categoryId: foodId,
    amountMinor: "25",
  })
  await scenario.transfer({
    sourceAccountId: cashId,
    destinationAccountId: savingsId,
    amountMinor: "10",
  })

  return { scenario, cashId, foodId }
}

async function snapshotState(scenario: FinancialQueryScenario) {
  const { database, publisher } = scenario
  const [books, accounts, entries, postings, sequences] = await Promise.all([
    database.query(
      "SELECT id, name, base_currency, timezone, version " +
        "FROM financial_books ORDER BY id"
    ),
    database.query(
      "SELECT id, book_id, name, normalized_name, kind, status, " +
        "system_purpose, version FROM ledger_accounts ORDER BY id"
    ),
    database.query(
      "SELECT id, book_id, occurred_on, recorded_at, sequence, description, " +
        "currency, origin, reversal_of_id, reversed_by_id, version " +
        "FROM journal_entries ORDER BY id"
    ),
    database.query(
      "SELECT id, book_id, journal_entry_id, account_id, position, " +
        "amount_minor, currency FROM postings ORDER BY id"
    ),
    database.query(
      "SELECT book_id, last_sequence FROM journal_sequences ORDER BY book_id"
    ),
  ])

  return {
    books,
    accounts,
    entries,
    postings,
    sequences,
    events: publisher.events,
  }
}

async function readAllQueries(
  scenario: FinancialQueryScenario,
  cashId: string,
  foodId: string
) {
  const ledger = new SqliteLedgerQueries(scenario.database)
  const insights = new SqliteInsightQueries(scenario.database)
  return {
    balances: await ledger.listAccountBalances({
      bookId,
      includeArchived: true,
      includeZeroBalance: true,
    }),
    statement: await ledger.listAccountStatement({
      bookId,
      accountId: cashId as never,
      limit: 100,
    }),
    journal: await ledger.listJournalEntries({ bookId, limit: 100 }),
    cashFlow: await insights.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-08" as never,
    }),
    category: await insights.getCategorySpending({
      bookId,
      from: LocalDate.parse("2026-08-01"),
      to: LocalDate.parse("2026-08-31"),
      categoryId: foodId as never,
    }),
    netWorth: await insights.getNetWorth({ bookId }),
  }
}

describe("financial query consistency and cost", () => {
  let scenario: FinancialQueryScenario | undefined

  beforeEach(async () => {
    scenario = undefined
  })

  afterEach(async () => {
    await scenario?.close()
  })

  it("repeats every new SQLite query without changing rows, versions, or events", async () => {
    const fixture = await createScenario()
    scenario = fixture.scenario

    const before = await snapshotState(scenario)
    const first = await readAllQueries(scenario, fixture.cashId, fixture.foodId)
    const between = await snapshotState(scenario)
    const second = await readAllQueries(
      scenario,
      fixture.cashId,
      fixture.foodId
    )
    const after = await snapshotState(scenario)

    expect(first).toEqual(second)
    expect(between).toEqual(before)
    expect(after).toEqual(before)
    expect(before.events).toEqual([])
    expect(after.events).toEqual([])
  })

  it.each(["balance", "statement", "journal"] as const)(
    "uses one deferred snapshot for the real multi-statement %s query",
    async (kind) => {
      const connection = new Database(":memory:")
      const database = new BetterSqliteDatabase(connection)
      const fixture = await createScenario(database)
      scenario = fixture.scenario
      const originalExec = connection.exec.bind(connection)
      const execSpy = vi
        .spyOn(connection, "exec")
        .mockImplementation((sql) => originalExec(sql))
      const originalQuery = database.queryOnConnection.bind(database)
      let queryCount = 0
      let externalUpdate: Promise<unknown> | undefined
      vi.spyOn(database, "queryOnConnection").mockImplementation(
        (sql, parameters) => {
          const rows = originalQuery(sql, parameters)
          queryCount += 1
          if (queryCount === 1) {
            externalUpdate = database.execute(
              "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND name = ?",
              [
                "Changed during read",
                bookId,
                kind === "balance" ? "Checking" : "Savings",
              ]
            )
          }
          return rows
        }
      )

      const result =
        kind === "balance"
          ? await new SqliteLedgerQueries(database).getAccountBalance({
              bookId,
              accountId: fixture.cashId as never,
            })
          : kind === "statement"
            ? await new SqliteLedgerQueries(database).listAccountStatement({
                bookId,
                accountId: fixture.cashId as never,
                limit: 100,
              })
            : await new SqliteLedgerQueries(database).listJournalEntries({
                bookId,
                limit: 100,
              })

      await externalUpdate
      expect(queryCount).toBe(2)
      expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("BEGIN")
      expect(execSpy.mock.calls.map(([sql]) => sql)).not.toContain(
        "BEGIN IMMEDIATE"
      )
      expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("COMMIT")
      if (kind === "balance") {
        expect(result.accountName).toBe("Checking")
      } else if (kind === "statement") {
        expect(result.items[0]?.counterpartyAccounts).toContainEqual({
          id: expect.any(String),
          name: "Savings",
          kind: "ASSET",
        })
      } else {
        expect(result.items[0]?.financialAccounts).toContainEqual({
          id: expect.any(String),
          name: "Savings",
          kind: "ASSET",
        })
      }
      expect(
        await database.query<{ readonly name: string }>(
          "SELECT name FROM ledger_accounts WHERE book_id = ? AND name = ?",
          [bookId, "Changed during read"]
        )
      ).toHaveLength(1)
    }
  )

  it("rolls back an actual multi-statement query when its detail statement fails", async () => {
    const connection = new Database(":memory:")
    const database = new BetterSqliteDatabase(connection)
    const fixture = await createScenario(database)
    scenario = fixture.scenario
    const originalExec = connection.exec.bind(connection)
    const execSpy = vi
      .spyOn(connection, "exec")
      .mockImplementation((sql) => originalExec(sql))
    const originalQuery = database.queryOnConnection.bind(database)
    const failure = new Error("SQL SELECT secret=42 /tmp/private.db")
    let queryCount = 0
    vi.spyOn(database, "queryOnConnection").mockImplementation(
      (sql, parameters) => {
        queryCount += 1
        if (queryCount === 2) {
          throw failure
        }
        return originalQuery(sql, parameters)
      }
    )

    await expect(
      new SqliteLedgerQueries(database).listJournalEntries({
        bookId,
        limit: 100,
      })
    ).rejects.toBe(failure)
    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("BEGIN")
    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK")
    expect(execSpy.mock.calls.map(([sql]) => sql)).not.toContain("COMMIT")
    await expect(
      database.query<{ readonly count: number }>(
        "SELECT COUNT(*) AS count FROM journal_entries WHERE book_id = ?",
        [bookId]
      )
    ).resolves.toEqual([{ count: 4 }])
  })

  it("keeps exact-balance reads bounded for one and many returned items", async () => {
    const fixture = await createScenario()
    scenario = fixture.scenario
    const ledger = new SqliteLedgerQueries(scenario.database)

    const count = async (work: () => Promise<unknown>) => {
      const spy = vi.spyOn(scenario!.database, "queryOnConnection")
      await work()
      const calls = spy.mock.calls.length
      spy.mockRestore()
      return calls
    }

    expect(
      await count(() =>
        ledger.listAccountBalances({
          bookId,
          accountKinds: ["LIABILITY"],
          includeArchived: true,
          includeZeroBalance: true,
        })
      )
    ).toBe(2)
    expect(
      await count(() =>
        ledger.listAccountBalances({
          bookId,
          includeArchived: true,
          includeZeroBalance: true,
        })
      )
    ).toBe(2)

    expect(
      await count(() =>
        ledger.listAccountStatement({
          bookId,
          accountId: fixture.cashId as never,
          from: LocalDate.parse("2026-08-01"),
          to: LocalDate.parse("2026-08-01"),
          limit: 100,
        })
      )
    ).toBe(2)
    expect(
      await count(() =>
        ledger.listAccountStatement({
          bookId,
          accountId: fixture.cashId as never,
          limit: 100,
        })
      )
    ).toBe(2)

    expect(
      await count(() =>
        ledger.listJournalEntries({
          bookId,
          from: LocalDate.parse("2026-08-01"),
          to: LocalDate.parse("2026-08-01"),
          limit: 100,
        })
      )
    ).toBe(2)
    expect(
      await count(() =>
        ledger.listJournalEntries({
          bookId,
          limit: 100,
        })
      )
    ).toBe(2)
  })
})
