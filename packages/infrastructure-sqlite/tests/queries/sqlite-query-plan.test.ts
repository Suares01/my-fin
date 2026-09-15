import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import type { SqliteParameters } from "../../src/database/sqlite-value.js"
import {
  sqliteMigrations,
  SqliteMigrationRunner,
} from "../../src/migrations/index.js"
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type PlanRow = { readonly detail: string }
type QueryCall = {
  readonly sql: string
  readonly parameters?: SqliteParameters
}

async function captureQueries(
  database: BetterSqliteDatabase,
  work: () => Promise<unknown>
): Promise<readonly QueryCall[]> {
  const calls: QueryCall[] = []
  const originalQuery = database.queryOnConnection.bind(database)
  const querySpy = vi
    .spyOn(database, "queryOnConnection")
    .mockImplementation((sql, parameters) => {
      calls.push({ sql, parameters })
      return originalQuery(sql, parameters)
    })
  await work()
  querySpy.mockRestore()
  return calls
}

async function explain(
  database: BetterSqliteDatabase,
  call: QueryCall
): Promise<readonly PlanRow[]> {
  return database.query<PlanRow>(
    `EXPLAIN QUERY PLAN ${call.sql}`,
    call.parameters
  )
}

describe("financial query SQLite plans", () => {
  let database: BetterSqliteDatabase

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await configureSqliteConnection(database, { inMemory: true })
    await new SqliteMigrationRunner(database, sqliteMigrations).migrate()
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
        "VALUES (?, ?, ?, ?, ?)",
      ["book-1", "Main book", "BRL", "America/Sao_Paulo", 0]
    )
    await database.execute(
      "INSERT INTO ledger_accounts " +
        "(id, book_id, name, normalized_name, kind, status, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["account-1", "book-1", "Cash", "cash", "ASSET", "ACTIVE", 0]
    )
    await database.executeBatch(
      "INSERT INTO journal_entries " +
        "(id, book_id, occurred_on, recorded_at, sequence, description, currency, origin, version) " +
        "VALUES " +
        "('entry-9', 'book-1', '2026-08-04', '2026-08-04T09:00:00.000Z', '9', 'Nine', 'BRL', 'MANUAL', 0)," +
        "('entry-10', 'book-1', '2026-08-04', '2026-08-04T10:00:00.000Z', '10', 'Ten', 'BRL', 'MANUAL', 0);"
    )
    await database.executeBatch(
      "INSERT INTO postings " +
        "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
        "VALUES " +
        "('posting-9', 'book-1', 'entry-9', 'account-1', 0, 100, 'BRL')," +
        "('posting-10', 'book-1', 'entry-10', 'account-1', 0, 200, 'BRL');"
    )
  })

  afterEach(async () => {
    await database.close()
  })

  it("orders same-day sequences numerically, including 9 and 10", async () => {
    await expect(
      database.query<{ id: string }>(
        "SELECT id FROM journal_entries WHERE book_id = ? " +
          "ORDER BY occurred_on DESC, length(sequence) DESC, sequence DESC",
        ["book-1"]
      )
    ).resolves.toEqual([{ id: "entry-10" }, { id: "entry-9" }])
  })

  it("uses the numeric sequence index for the journal ordering shape", async () => {
    const plan = await database.query<PlanRow>(
      "EXPLAIN QUERY PLAN SELECT id FROM journal_entries " +
        "WHERE book_id = ? ORDER BY occurred_on DESC, " +
        "length(sequence) DESC, sequence DESC LIMIT ?",
      ["book-1", 20]
    )

    expect(
      plan.some(({ detail }) =>
        detail.includes("ix_journal_entries_book_date_sequence_numeric")
      )
    ).toBe(true)
  })

  it("uses the account posting index for entry and position ordering", async () => {
    const plan = await database.query<PlanRow>(
      "EXPLAIN QUERY PLAN SELECT journal_entry_id, position FROM postings " +
        "WHERE book_id = ? AND account_id = ? " +
        "ORDER BY journal_entry_id, position",
      ["book-1", "account-1"]
    )

    expect(
      plan.some(({ detail }) =>
        detail.includes("ix_postings_book_account_entry_position")
      )
    ).toBe(true)
  })

  it("explains the SQL emitted by the account balance list adapter", async () => {
    const queries = new SqliteLedgerQueries(database)
    const calls = await captureQueries(database, () =>
      queries.listAccountBalances({
        bookId: "book-1" as never,
        includeArchived: true,
        includeZeroBalance: true,
      })
    )

    expect(calls).toHaveLength(2)
    const accountPlan = await explain(database, calls[0] as QueryCall)
    const postingPlan = await explain(database, calls[1] as QueryCall)

    expect(calls[0]?.sql).toContain("FROM ledger_accounts")
    expect(accountPlan.length).toBeGreaterThan(0)
    expect(
      postingPlan.some(({ detail }) =>
        detail.includes("ix_postings_book_account_entry_position")
      )
    ).toBe(true)
  })

  it("explains the SQL emitted by the paginated statement adapter", async () => {
    const queries = new SqliteLedgerQueries(database)
    const calls = await captureQueries(database, () =>
      queries.listAccountStatement({
        bookId: "book-1" as never,
        accountId: "account-1" as never,
        limit: 10,
      })
    )

    expect(calls).toHaveLength(2)
    const plan = await explain(database, calls[0] as QueryCall)

    expect(
      plan.some(({ detail }) => detail.includes("ix_postings_account_entry"))
    ).toBe(true)
  })

  it("explains the SQL emitted by the paginated journal list adapter", async () => {
    const queries = new SqliteLedgerQueries(database)
    const calls = await captureQueries(database, () =>
      queries.listJournalEntries({
        bookId: "book-1" as never,
        limit: 10,
      })
    )

    expect(calls).toHaveLength(2)
    const plan = await explain(database, calls[0] as QueryCall)

    expect(
      plan.some(({ detail }) =>
        detail.includes("ix_journal_entries_book_date_sequence_numeric")
      )
    ).toBe(true)
  })
})
