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
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
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
  occurredOn = "2026-08-04",
  origin: "MANUAL" | "SYSTEM" = "MANUAL",
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
    origin,
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

describe("SqliteLedgerQueries.listJournalEntries", () => {
  let database: BetterSqliteDatabase
  let books: SqliteFinancialBookRepository
  let accounts: SqliteLedgerAccountRepository
  let entries: SqliteJournalEntryRepository
  let queries: SqliteLedgerQueries

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    books = new SqliteFinancialBookRepository(database)
    accounts = new SqliteLedgerAccountRepository(database)
    entries = new SqliteJournalEntryRepository(database)
    queries = new SqliteLedgerQueries(database)
    await books.add(makeBook())
    for (const [id, kind] of [
      ["cash", "ASSET"],
      ["cash-two", "ASSET"],
      ["card", "LIABILITY"],
      ["income", "INCOME"],
      ["expense", "EXPENSE"],
      ["expense-two", "EXPENSE"],
      ["equity", "EQUITY"],
    ] as const) {
      await accounts.add(makeAccount(id, kind))
    }
  })

  afterEach(async () => database.close())

  it("returns complete income, expense and transfer classifications", async () => {
    await entries.add(
      makeEntry(
        "salary",
        [
          { accountId: "cash", amountMinor: 100n },
          { accountId: "income", amountMinor: -100n },
        ],
        "1"
      )
    )
    await entries.add(
      makeEntry(
        "groceries",
        [
          { accountId: "cash", amountMinor: -40n },
          { accountId: "expense", amountMinor: 40n },
        ],
        "2"
      )
    )
    await entries.add(
      makeEntry(
        "transfer",
        [
          { accountId: "cash", amountMinor: -20n },
          { accountId: "cash-two", amountMinor: 20n },
        ],
        "3"
      )
    )
    await entries.add(
      makeEntry(
        "liability-transfer",
        [
          { accountId: "card", amountMinor: -15n },
          { accountId: "cash", amountMinor: 15n },
        ],
        "4"
      )
    )

    const result = await queries.listJournalEntries({ bookId, limit: 10 })

    expect(
      result.items.map(({ id, incomeMinor, expenseMinor, transferMinor }) => ({
        id,
        incomeMinor,
        expenseMinor,
        transferMinor,
      }))
    ).toEqual([
      {
        id: "liability-transfer",
        incomeMinor: "0",
        expenseMinor: "0",
        transferMinor: "15",
      },
      {
        id: "transfer",
        incomeMinor: "0",
        expenseMinor: "0",
        transferMinor: "20",
      },
      {
        id: "groceries",
        incomeMinor: "0",
        expenseMinor: "40",
        transferMinor: "0",
      },
      {
        id: "salary",
        incomeMinor: "100",
        expenseMinor: "0",
        transferMinor: "0",
      },
    ])
    expect(result.items.find(({ id }) => id === "transfer")).toEqual(
      expect.objectContaining({
        financialAccounts: [
          { id: "cash", name: "cash", kind: "ASSET" },
          { id: "cash-two", name: "cash-two", kind: "ASSET" },
        ],
        categories: [],
        isSplit: false,
        isReversal: false,
        isReversed: false,
        currency: "BRL",
      })
    )
    expect(result.items.find(({ id }) => id === "transfer")).toEqual({
      id: "transfer",
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T12:00:00.000Z",
      sequence: "3",
      description: "transfer",
      origin: "MANUAL",
      financialAccounts: [
        { id: "cash", name: "cash", kind: "ASSET" },
        { id: "cash-two", name: "cash-two", kind: "ASSET" },
      ],
      categories: [],
      incomeMinor: "0",
      expenseMinor: "0",
      transferMinor: "20",
      currency: "BRL",
      isSplit: false,
      isReversal: false,
      isReversed: false,
    })
  })

  it("marks split entries and assigns each category posting to the result", async () => {
    await entries.add(
      makeEntry(
        "split",
        [
          { accountId: "cash", amountMinor: -50n },
          { accountId: "expense", amountMinor: 30n },
          { accountId: "expense-two", amountMinor: 20n },
        ],
        "1"
      )
    )

    const result = await queries.listJournalEntries({ bookId, limit: 10 })

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        expenseMinor: "50",
        isSplit: true,
        categories: [
          { id: "expense", name: "expense", kind: "EXPENSE" },
          { id: "expense-two", name: "expense-two", kind: "EXPENSE" },
        ],
      })
    )
  })

  it("applies date, account, category and origin filters as intersections", async () => {
    await entries.add(
      makeEntry(
        "matching",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "1",
        "2026-08-02"
      )
    )
    await entries.add(
      makeEntry(
        "account-union",
        [
          { accountId: "cash-two", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "2",
        "2026-08-02"
      )
    )
    await entries.add(
      makeEntry(
        "category-union",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense-two", amountMinor: 10n },
        ],
        "3",
        "2026-08-02"
      )
    )
    await entries.add(
      makeEntry(
        "origin-union",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "4",
        "2026-08-02",
        "SYSTEM"
      )
    )
    await entries.add(
      makeEntry(
        "outside-account",
        [
          { accountId: "equity", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "5",
        "2026-08-02"
      )
    )
    await entries.add(
      makeEntry(
        "outside-category",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "income", amountMinor: 10n },
        ],
        "6",
        "2026-08-02"
      )
    )

    const result = await queries.listJournalEntries({
      bookId,
      from: { value: "2026-08-02" } as never,
      to: { value: "2026-08-02" } as never,
      accountIds: ["cash" as never, "cash-two" as never],
      categoryIds: ["expense" as never, "expense-two" as never],
      origins: ["MANUAL", "SYSTEM"],
      limit: 10,
    })

    expect(result.items.map(({ id }) => id)).toEqual([
      "origin-union",
      "category-union",
      "account-union",
      "matching",
    ])
  })

  it("uses a literal, case-sensitive trimmed search", async () => {
    await entries.add(
      makeEntry(
        "upper",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "1"
      )
    )
    await database.execute(
      "UPDATE journal_entries SET description = ? WHERE id = ?",
      ["Salary Bonus", "upper"]
    )
    await entries.add(
      makeEntry(
        "lower",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "2"
      )
    )
    await database.execute(
      "UPDATE journal_entries SET description = ? WHERE id = ?",
      ["salary bonus", "lower"]
    )

    const result = await queries.listJournalEntries({
      bookId,
      search: "Salary",
      limit: 10,
    })

    expect(result.items.map(({ id }) => id)).toEqual(["upper"])
  })

  it("paginates by numeric sequence without gaps or duplicates", async () => {
    for (const sequence of ["9", "10", "11"] as const) {
      await entries.add(
        makeEntry(
          `entry-${sequence}`,
          [
            { accountId: "cash", amountMinor: -1n },
            { accountId: "expense", amountMinor: 1n },
          ],
          sequence
        )
      )
    }

    const first = await queries.listJournalEntries({ bookId, limit: 2 })
    const second = await queries.listJournalEntries({
      bookId,
      limit: 2,
      cursor: first.nextKey ?? undefined,
    })

    expect(first.items.map(({ id }) => id)).toEqual(["entry-11", "entry-10"])
    expect(first.nextKey).toEqual({ occurredOn: "2026-08-04", sequence: "10" })
    expect(second.items.map(({ id }) => id)).toEqual(["entry-9"])
    expect(second.nextKey).toBeNull()
  })

  it("keeps original and reversal flags distinct", async () => {
    await entries.add(
      makeEntry(
        "original",
        [
          { accountId: "cash", amountMinor: -30n },
          { accountId: "expense", amountMinor: 30n },
        ],
        "1"
      )
    )
    await entries.add(
      makeEntry(
        "reversal",
        [
          { accountId: "cash", amountMinor: 30n },
          { accountId: "expense", amountMinor: -30n },
        ],
        "2",
        "2026-08-05",
        "SYSTEM",
        "original"
      )
    )
    await database.execute(
      "UPDATE journal_entries SET reversed_by_id = ? WHERE id = ?",
      ["reversal", "original"]
    )

    const result = await queries.listJournalEntries({ bookId, limit: 10 })

    expect(
      result.items.map(({ id, isReversal, isReversed }) => ({
        id,
        isReversal,
        isReversed,
      }))
    ).toEqual([
      { id: "reversal", isReversal: true, isReversed: false },
      { id: "original", isReversal: false, isReversed: true },
    ])
  })

  it("isolates entries and currency by book", async () => {
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
        "2026-08-04",
        "MANUAL",
        undefined,
        "book-2" as never
      )
    )

    const result = await queries.listJournalEntries({ bookId, limit: 10 })

    expect(result.items.map(({ id, currency }) => ({ id, currency }))).toEqual(
      []
    )
  })

  it("preserves large amounts and runs two statements regardless of item count", async () => {
    await entries.add(
      makeEntry(
        "large",
        [
          { accountId: "cash", amountMinor: -9007199254740993n },
          { accountId: "expense", amountMinor: 9007199254740993n },
        ],
        "1"
      )
    )
    const querySpy = vi.spyOn(database, "queryOnConnection")

    const result = await queries.listJournalEntries({ bookId, limit: 10 })

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        expenseMinor: "9007199254740993",
        currency: "BRL",
      })
    )
    expect(querySpy).toHaveBeenCalledTimes(2)
  })

  it("returns an empty page when no entry matches the filters", async () => {
    const result = await queries.listJournalEntries({
      bookId,
      accountIds: ["cash" as never],
      search: "not-found",
      limit: 10,
    })

    expect(result).toEqual({ items: [], nextKey: null })
  })

  it("returns zero transfer for category entries even when they have two postings", async () => {
    await entries.add(
      makeEntry(
        "category-pair",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "1"
      )
    )

    const result = await queries.listJournalEntries({ bookId, limit: 10 })

    expect(result.items[0]?.transferMinor).toBe("0")
  })

  it("uses origin filters without multiplying entries", async () => {
    await entries.add(
      makeEntry(
        "manual",
        [
          { accountId: "cash", amountMinor: -10n },
          { accountId: "expense", amountMinor: 10n },
        ],
        "1"
      )
    )
    await entries.add(
      makeEntry(
        "system",
        [
          { accountId: "cash", amountMinor: -20n },
          { accountId: "expense", amountMinor: 20n },
        ],
        "2",
        "2026-08-04",
        "SYSTEM"
      )
    )

    const result = await queries.listJournalEntries({
      bookId,
      origins: ["SYSTEM"],
      limit: 10,
    })

    expect(result.items.map(({ id }) => id)).toEqual(["system"])
  })
})
