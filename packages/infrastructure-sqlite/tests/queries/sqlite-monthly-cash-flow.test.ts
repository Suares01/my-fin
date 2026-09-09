import {
  FinancialBook,
  JournalEntry,
  LedgerAccount,
  type LedgerAccountKind,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { SqliteInsightQueries } from "../../src/queries/sqlite-insight-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const bookId = "book-1" as never

function makeBook(id = "book-1", currency = "BRL"): FinancialBook {
  return FinancialBook.restore({
    id: id as never,
    name: id,
    baseCurrency: currency,
    timezone: "America/Sao_Paulo",
    version: 0,
  })
}

function makeAccount(
  id: string,
  kind: LedgerAccountKind,
  currentBookId = bookId
): LedgerAccount {
  return LedgerAccount.restore({
    id: id as never,
    bookId: currentBookId,
    name: id,
    normalizedName: id,
    kind,
    status: "ACTIVE",
    ...(kind === "INCOME"
      ? { iconKey: "label-dollar", colorHex: "10b981" }
      : kind === "EXPENSE"
        ? { iconKey: "label-dollar", colorHex: "f43f5e" }
        : {}),
    version: 0,
  })
}

function makeEntry(
  id: string,
  postings: readonly {
    readonly accountId: string
    readonly amountMinor: bigint
  }[],
  sequence: string,
  occurredOn: string,
  reversalOf?: string,
  currentBookId = bookId
): JournalEntry {
  return JournalEntry.restore({
    id: id as never,
    bookId: currentBookId,
    occurredOn,
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence,
    description: id,
    currency: "BRL",
    origin: reversalOf === undefined ? "MANUAL" : "SYSTEM",
    postings: postings.map((posting, position) => ({
      id: `${id}-${position}` as never,
      accountId: posting.accountId as never,
      amountMinor: posting.amountMinor,
      currency: "BRL",
    })),
    ...(reversalOf === undefined ? {} : { reversalOf: reversalOf as never }),
    version: 0,
  })
}

describe("SqliteInsightQueries.getMonthlyCashFlow", () => {
  let database: BetterSqliteDatabase
  let books: SqliteFinancialBookRepository
  let accounts: SqliteLedgerAccountRepository
  let entries: SqliteJournalEntryRepository
  let queries: SqliteInsightQueries

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    books = new SqliteFinancialBookRepository(database)
    accounts = new SqliteLedgerAccountRepository(database)
    entries = new SqliteJournalEntryRepository(database)
    queries = new SqliteInsightQueries(database)
    await books.add(makeBook())
    for (const [id, kind] of [
      ["cash", "ASSET"],
      ["card", "LIABILITY"],
      ["cash-two", "ASSET"],
      ["income", "INCOME"],
      ["expense", "EXPENSE"],
    ] as const) {
      await accounts.add(makeAccount(id, kind))
    }
  })

  afterEach(async () => database.close())

  it("returns every inclusive month, including empty months, with exact net", async () => {
    await entries.add(
      makeEntry(
        "income-aug",
        [
          { accountId: "cash", amountMinor: 100n },
          { accountId: "income", amountMinor: -100n },
        ],
        "1",
        "2026-08-01"
      )
    )
    await entries.add(
      makeEntry(
        "expense-oct",
        [
          { accountId: "cash", amountMinor: -40n },
          { accountId: "expense", amountMinor: 40n },
        ],
        "2",
        "2026-10-01"
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-10" as never,
    })

    expect(result).toEqual([
      {
        month: "2026-08",
        incomeMinor: "100",
        expenseMinor: "0",
        netMinor: "100",
        currency: "BRL",
      },
      {
        month: "2026-09",
        incomeMinor: "0",
        expenseMinor: "0",
        netMinor: "0",
        currency: "BRL",
      },
      {
        month: "2026-10",
        incomeMinor: "0",
        expenseMinor: "40",
        netMinor: "-40",
        currency: "BRL",
      },
    ])
  })

  it("includes income and expense signs exactly", async () => {
    await entries.add(
      makeEntry(
        "income",
        [
          { accountId: "cash", amountMinor: 100n },
          { accountId: "income", amountMinor: -100n },
        ],
        "1",
        "2026-08-01"
      )
    )
    await entries.add(
      makeEntry(
        "expense",
        [
          { accountId: "cash", amountMinor: -35n },
          { accountId: "expense", amountMinor: 35n },
        ],
        "2",
        "2026-08-02"
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-08" as never,
    })

    expect(result[0]).toEqual({
      month: "2026-08",
      incomeMinor: "100",
      expenseMinor: "35",
      netMinor: "65",
      currency: "BRL",
    })
  })

  it("ignores transfers and liability payments but includes a liability purchase", async () => {
    await entries.add(
      makeEntry(
        "transfer",
        [
          { accountId: "cash", amountMinor: -20n },
          { accountId: "cash-two", amountMinor: 20n },
        ],
        "1",
        "2026-08-01"
      )
    )
    await entries.add(
      makeEntry(
        "payment",
        [
          { accountId: "card", amountMinor: 20n },
          { accountId: "cash", amountMinor: -20n },
        ],
        "2",
        "2026-08-02"
      )
    )
    await entries.add(
      makeEntry(
        "purchase",
        [
          { accountId: "card", amountMinor: -50n },
          { accountId: "expense", amountMinor: 50n },
        ],
        "3",
        "2026-08-03"
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-08" as never,
    })

    expect(result[0]).toEqual(
      expect.objectContaining({
        incomeMinor: "0",
        expenseMinor: "50",
        netMinor: "-50",
      })
    )
  })

  it("places original and reversal effects in their occurred months", async () => {
    await entries.add(
      makeEntry(
        "original",
        [
          { accountId: "cash", amountMinor: -100n },
          { accountId: "expense", amountMinor: 100n },
        ],
        "1",
        "2026-08-31"
      )
    )
    await entries.add(
      makeEntry(
        "reversal",
        [
          { accountId: "cash", amountMinor: 100n },
          { accountId: "expense", amountMinor: -100n },
        ],
        "2",
        "2026-09-01",
        "original"
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-09" as never,
    })

    expect(
      result.map(({ month, expenseMinor }) => ({ month, expenseMinor }))
    ).toEqual([
      { month: "2026-08", expenseMinor: "100" },
      { month: "2026-09", expenseMinor: "-100" },
    ])
    expect(
      result.reduce((sum, item) => sum + BigInt(item.netMinor), 0n).toString()
    ).toBe("0")
  })

  it("preserves int64 amounts as strings", async () => {
    await entries.add(
      makeEntry(
        "large",
        [
          { accountId: "cash", amountMinor: -9007199254740993n },
          { accountId: "expense", amountMinor: 9007199254740993n },
        ],
        "1",
        "2026-08-01"
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-08" as never,
    })

    expect(result[0]?.expenseMinor).toBe("9007199254740993")
  })

  it("uses the book currency and never mixes another book", async () => {
    await books.add(makeBook("book-2", "USD"))
    await accounts.add(makeAccount("foreign-cash", "ASSET", "book-2" as never))
    await accounts.add(
      makeAccount("foreign-expense", "EXPENSE", "book-2" as never)
    )
    await entries.add(
      makeEntry(
        "foreign",
        [
          { accountId: "foreign-cash", amountMinor: -90n },
          { accountId: "foreign-expense", amountMinor: 90n },
        ],
        "1",
        "2026-08-01",
        undefined,
        "book-2" as never
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-08" as never,
    })

    expect(result[0]).toEqual(
      expect.objectContaining({ expenseMinor: "0", currency: "BRL" })
    )
  })

  it("returns zeros for a book with no financial activity", async () => {
    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-08" as never,
      toMonth: "2026-09" as never,
    })

    expect(result).toEqual([
      {
        month: "2026-08",
        incomeMinor: "0",
        expenseMinor: "0",
        netMinor: "0",
        currency: "BRL",
      },
      {
        month: "2026-09",
        incomeMinor: "0",
        expenseMinor: "0",
        netMinor: "0",
        currency: "BRL",
      },
    ])
  })

  it("executes one aggregate statement for the complete month range", async () => {
    const querySpy = vi.spyOn(database, "queryOnConnection")

    await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-01" as never,
      toMonth: "2026-12" as never,
    })

    expect(querySpy).toHaveBeenCalledTimes(1)
  })

  it("handles the December to January boundary", async () => {
    await entries.add(
      makeEntry(
        "new-year",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "1",
        "2027-01-01"
      )
    )

    const result = await queries.getMonthlyCashFlow({
      bookId,
      fromMonth: "2026-12" as never,
      toMonth: "2027-01" as never,
    })

    expect(
      result.map(({ month, expenseMinor }) => ({ month, expenseMinor }))
    ).toEqual([
      { month: "2026-12", expenseMinor: "0" },
      { month: "2027-01", expenseMinor: "10" },
    ])
  })
})
