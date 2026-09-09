import {
  FinancialBook,
  JournalEntry,
  LedgerAccount,
  type LedgerAccountKind,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const bookId = "book-1" as never

function book(id = "book-1", currency = "BRL"): FinancialBook {
  return FinancialBook.restore({
    id: id as never,
    name: id,
    baseCurrency: currency,
    timezone: "America/Sao_Paulo",
    version: 0,
  })
}

function account(
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

function entry(
  id: string,
  occurredOn: string,
  accountId: string,
  amountMinor: bigint,
  sequence: string,
  currentBookId = bookId,
  reversalOf?: string,
  counterAccountId = "counter-account"
): JournalEntry {
  return JournalEntry.restore({
    id: id as never,
    bookId: currentBookId,
    occurredOn,
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence,
    description: id,
    currency: "BRL",
    origin: "MANUAL",
    postings: [
      {
        id: `${id}-posting` as never,
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
    ...(reversalOf === undefined ? {} : { reversalOf: reversalOf as never }),
    version: 0,
  })
}

describe("SqliteLedgerQueries", () => {
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
    await books.add(book())
    await accounts.add(account("counter-account", "EQUITY"))
  })

  afterEach(async () => {
    await database.close()
  })

  it("limits balance to postings on or before asOf", async () => {
    await accounts.add(account("account-asset", "ASSET"))
    await entries.add(
      entry("entry-before", "2026-08-01", "account-asset", 100n, "1")
    )
    await entries.add(
      entry("entry-after", "2026-08-05", "account-asset", 900n, "2")
    )

    await expect(
      queries.getAccountBalance({
        bookId,
        accountId: "account-asset" as never,
        asOf: { value: "2026-08-01" } as never,
      })
    ).resolves.toEqual({
      accountId: "account-asset",
      accountName: "account-asset",
      accountKind: "ASSET",
      rawBalanceMinor: "100",
      displayBalanceMinor: "100",
      asOf: "2026-08-01",
      amountMinor: "100",
      currency: "BRL",
    })
  })

  it("returns zero and the book currency when an account has no postings", async () => {
    await accounts.add(account("empty-account", "ASSET"))

    await expect(
      queries.getAccountBalance({
        bookId,
        accountId: "empty-account" as never,
      })
    ).resolves.toEqual({
      accountId: "empty-account",
      accountName: "empty-account",
      accountKind: "ASSET",
      rawBalanceMinor: "0",
      displayBalanceMinor: "0",
      asOf: null,
      amountMinor: "0",
      currency: "BRL",
    })
  })

  it.each([
    ["ASSET", "100"],
    ["LIABILITY", "-100"],
    ["INCOME", "-100"],
    ["EXPENSE", "100"],
    ["EQUITY", "-100"],
  ] as const)(
    "applies the normal balance sign for %s accounts",
    async (kind, expected) => {
      const accountId = `account-${kind}`
      await accounts.add(account(accountId, kind))
      await entries.add(
        entry(`entry-${kind}`, "2026-08-01", accountId, 100n, "1")
      )

      const result = await queries.getAccountBalance({
        bookId,
        accountId: accountId as never,
      })

      expect(result.amountMinor).toBe(expected)
      expect(result.displayBalanceMinor).toBe(expected)
      expect(result.amountMinor).toBe(result.displayBalanceMinor)
    }
  )
})
