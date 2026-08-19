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

const mainBook = "book-1" as never

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
  bookId = mainBook,
  name = id
): LedgerAccount {
  return LedgerAccount.restore({
    id: id as never,
    bookId,
    name,
    normalizedName: name.toLowerCase(),
    kind,
    status: "ACTIVE",
    version: 0,
  })
}

function makeEntry(
  id: string,
  accountId: string,
  amountMinor: bigint,
  sequence: string,
  occurredOn = "2026-08-04",
  bookId = mainBook,
  counterAccountId = "counter"
): JournalEntry {
  return JournalEntry.restore({
    id: id as never,
    bookId,
    occurredOn,
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence,
    description: id,
    currency: "BRL",
    origin: "MANUAL",
    postings: [
      {
        id: `${id}-main` as never,
        accountId: accountId as never,
        amountMinor,
        currency: "BRL",
      },
      {
        id: `${id}-counter` as never,
        accountId: counterAccountId as never,
        amountMinor: -amountMinor,
        currency: "BRL",
      },
    ],
    version: 0,
  })
}

describe("SqliteLedgerQueries.listAccountBalances", () => {
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
    await accounts.add(makeAccount("counter", "EQUITY"))
  })

  afterEach(async () => database.close())

  it("returns active and zero accounts in kind/name/id order", async () => {
    await accounts.add(makeAccount("z-cash", "ASSET"))
    await accounts.add(makeAccount("a-cash", "ASSET"))
    await accounts.add(makeAccount("income", "INCOME"))

    const result = await queries.listAccountBalances({
      bookId: mainBook,
      includeArchived: false,
      includeZeroBalance: true,
    })

    expect(
      result.map(({ accountId, accountKind, amountMinor }) => ({
        accountId,
        accountKind,
        amountMinor,
      }))
    ).toEqual([
      { accountId: "a-cash", accountKind: "ASSET", amountMinor: "0" },
      { accountId: "z-cash", accountKind: "ASSET", amountMinor: "0" },
      { accountId: "counter", accountKind: "EQUITY", amountMinor: "0" },
      { accountId: "income", accountKind: "INCOME", amountMinor: "0" },
    ])
  })

  it("applies archived, zero, kind and inclusive asOf filters", async () => {
    await accounts.add(makeAccount("active", "ASSET"))
    await accounts.add(makeAccount("archived", "ASSET"))
    const archived = await accounts.findById("archived" as never)
    archived?.archive()
    if (archived) await accounts.save(archived, 0)
    await entries.add(makeEntry("before", "active", 100n, "1", "2026-08-01"))
    await entries.add(makeEntry("after", "active", 900n, "2", "2026-08-05"))

    const result = await queries.listAccountBalances({
      bookId: mainBook,
      accountKinds: ["ASSET"],
      asOf: { value: "2026-08-01" } as never,
      includeArchived: true,
      includeZeroBalance: false,
    })

    expect(result).toEqual([
      expect.objectContaining({
        accountId: "active",
        rawBalanceMinor: "100",
        displayBalanceMinor: "100",
        asOf: "2026-08-01",
        archived: false,
      }),
    ])
  })

  it("omits a non-zero archived account by default and includes it explicitly", async () => {
    await accounts.add(makeAccount("archived-nonzero", "ASSET"))
    const archived = await accounts.findById("archived-nonzero" as never)
    archived?.archive()
    if (archived) await accounts.save(archived, 0)
    await entries.add(
      makeEntry("archived-entry", "archived-nonzero", 125n, "1")
    )

    await expect(
      queries.listAccountBalances({
        bookId: mainBook,
        includeArchived: false,
        includeZeroBalance: true,
      })
    ).resolves.toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ accountId: "archived-nonzero" }),
      ])
    )
    await expect(
      queries.listAccountBalances({
        bookId: mainBook,
        includeArchived: true,
        includeZeroBalance: true,
      })
    ).resolves.toContainEqual({
      accountId: "archived-nonzero",
      accountName: "archived-nonzero",
      accountKind: "ASSET",
      rawBalanceMinor: "125",
      displayBalanceMinor: "125",
      amountMinor: "125",
      currency: "BRL",
      asOf: null,
      archived: true,
      version: 1,
    })
  })

  it("uses account ID as the final tie-breaker for equal names", async () => {
    await accounts.add(makeAccount("cash-z", "ASSET", mainBook, "Cash Z"))
    await accounts.add(makeAccount("cash-a", "ASSET", mainBook, "Cash A"))
    await database.execute(
      "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND id = ?",
      ["Cash", mainBook, "cash-z"]
    )
    await database.execute(
      "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND id = ?",
      ["Cash", mainBook, "cash-a"]
    )

    const result = await queries.listAccountBalances({
      bookId: mainBook,
      accountKinds: ["ASSET"],
      includeArchived: true,
      includeZeroBalance: true,
    })

    expect(
      result
        .filter(({ accountName }) => accountName === "Cash")
        .map(({ accountId }) => accountId)
    ).toEqual(["cash-a", "cash-z"])
  })

  it("keeps an active zero account by default and removes it after asOf when disabled", async () => {
    await accounts.add(makeAccount("future-zero", "ASSET"))
    await entries.add(
      makeEntry("future-entry", "future-zero", 80n, "1", "2026-08-10")
    )

    await expect(
      queries.listAccountBalances({
        bookId: mainBook,
        asOf: { value: "2026-08-01" } as never,
        includeArchived: false,
        includeZeroBalance: true,
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        accountId: "future-zero",
        rawBalanceMinor: "0",
        displayBalanceMinor: "0",
      })
    )
    await expect(
      queries.listAccountBalances({
        bookId: mainBook,
        asOf: { value: "2026-08-01" } as never,
        includeArchived: false,
        includeZeroBalance: false,
      })
    ).resolves.not.toContainEqual(
      expect.objectContaining({
        accountId: "future-zero",
      })
    )
  })

  it.each([
    ["ASSET", "100"],
    ["LIABILITY", "-100"],
    ["INCOME", "-100"],
    ["EXPENSE", "100"],
    ["EQUITY", "-100"],
  ] as const)("uses the exact display sign for %s", async (kind, expected) => {
    const id = `account-${kind}`
    await accounts.add(makeAccount(id, kind))
    await entries.add(makeEntry(`entry-${kind}`, id, 100n, "1"))

    const result = await queries.listAccountBalances({
      bookId: mainBook,
      accountKinds: [kind],
      includeArchived: true,
      includeZeroBalance: true,
    })

    expect(result.find(({ accountId }) => accountId === id)).toEqual(
      expect.objectContaining({
        accountId: id,
        rawBalanceMinor: "100",
        displayBalanceMinor: expected,
        amountMinor: expected,
      })
    )
  })

  it("preserves int64 values and executes one statement for every result size", async () => {
    await accounts.add(makeAccount("large", "ASSET"))
    await entries.add(makeEntry("large-entry", "large", 9007199254740993n, "1"))
    const querySpy = vi.spyOn(database, "query")

    const result = await queries.listAccountBalances({
      bookId: mainBook,
      includeArchived: true,
      includeZeroBalance: true,
    })

    expect(result.find(({ accountId }) => accountId === "large")).toEqual(
      expect.objectContaining({
        rawBalanceMinor: "9007199254740993",
        displayBalanceMinor: "9007199254740993",
      })
    )
    expect(querySpy).toHaveBeenCalledTimes(1)
  })

  it("isolates accounts, metadata and currency by book", async () => {
    await books.add(makeBook("book-2", "USD"))
    await accounts.add(makeAccount("counter-2", "EQUITY", "book-2" as never))
    await accounts.add(makeAccount("foreign", "ASSET", "book-2" as never))
    await entries.add(
      makeEntry(
        "foreign-entry",
        "foreign",
        900n,
        "1",
        "2026-08-04",
        "book-2" as never,
        "counter-2"
      )
    )

    const result = await queries.listAccountBalances({
      bookId: mainBook,
      accountKinds: ["ASSET"],
      includeArchived: true,
      includeZeroBalance: true,
    })

    expect(
      result.find(({ accountId }) => accountId === "foreign")
    ).toBeUndefined()
    expect(result.every(({ currency }) => currency === "BRL")).toBe(true)
  })
})
