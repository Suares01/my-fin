import { ApplicationError } from "@workspace/application"
import {
  Currency,
  DomainError,
  FinancialBook,
  JournalEntry,
  LedgerAccount,
  LocalDate,
  Money,
  Posting,
  journalEntryIdFromString,
  ledgerAccountIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { SqliteDatabase } from "../../src/database/sqlite-database.js"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteTransactionManager } from "../../src/transaction/sqlite-transaction-manager.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

function book(id = "book-1"): FinancialBook {
  return FinancialBook.create({
    id: id as never,
    name: id,
    baseCurrency: Currency.parse("BRL"),
    timezone: "America/Sao_Paulo",
  })
}

function account(id: string): LedgerAccount {
  return LedgerAccount.create({
    id: ledgerAccountIdFromString(id),
    bookId: "book-1" as never,
    name: id,
    kind: "ASSET",
  })
}

function entryWithMissingAccount(): JournalEntry {
  return JournalEntry.post({
    id: journalEntryIdFromString("entry-1"),
    bookId: "book-1" as never,
    occurredOn: LocalDate.parse("2026-08-04"),
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: "Partial entry",
    currency: Currency.parse("BRL"),
    origin: "MANUAL",
    postings: [
      Posting.create({
        id: "posting-1" as never,
        accountId: ledgerAccountIdFromString("account-1"),
        amount: Money.of(100n, Currency.parse("BRL")),
      }),
      Posting.create({
        id: "posting-2" as never,
        accountId: ledgerAccountIdFromString("missing-account"),
        amount: Money.of(-100n, Currency.parse("BRL")),
      }),
    ],
  })
}

function persistedEntry(
  id: string,
  sequence: string,
  overrides: {
    readonly reversalOf?: string
  } = {}
): JournalEntry {
  return JournalEntry.restore({
    id: journalEntryIdFromString(id),
    bookId: "book-1" as never,
    occurredOn: "2026-08-04",
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence,
    description: id,
    currency: "BRL",
    origin: "MANUAL",
    postings: [
      {
        id: `${id}-posting-1` as never,
        accountId: ledgerAccountIdFromString("account-1"),
        amountMinor: 100n,
        currency: "BRL",
      },
      {
        id: `${id}-posting-2` as never,
        accountId: ledgerAccountIdFromString("account-2"),
        amountMinor: -100n,
        currency: "BRL",
      },
    ],
    version: 0,
    ...overrides,
  })
}

describe("SqliteTransactionManager", () => {
  let database: BetterSqliteDatabase
  let manager: SqliteTransactionManager

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    manager = new SqliteTransactionManager(database)
  })

  afterEach(async () => {
    await database.close()
  })

  it("commits repository writes and returns their value and facts in order", async () => {
    const committed = await manager.execute(async (repositories) => {
      await repositories.books.add(book())
      await repositories.books.add(book("book-2"))
      return "committed"
    })

    expect(committed.value).toBe("committed")
    expect(committed.facts.map((fact) => fact.aggregateId)).toEqual([
      "book-1",
      "book-2",
    ])
    expect(
      await database.query<{ readonly count: number }>(
        "SELECT COUNT(*) AS count FROM financial_books"
      )
    ).toEqual([{ count: 2 }])
  })

  it("rolls back writes and a reserved sequence after callback failure", async () => {
    await expect(
      manager.execute(async (repositories) => {
        await repositories.books.add(book())
        expect(
          await repositories.journalEntries.reserveNextSequence(
            "book-1" as never
          )
        ).toBe("1")
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")

    expect(
      await database.query<{
        readonly books: number
        readonly sequences: number
      }>(
        "SELECT " +
          "(SELECT COUNT(*) FROM financial_books) AS books, " +
          "(SELECT COUNT(*) FROM journal_sequences) AS sequences"
      )
    ).toEqual([{ books: 0, sequences: 0 }])
  })

  it("does not leak facts from a rolled-back callback", async () => {
    await expect(
      manager.execute(async (repositories) => {
        await repositories.books.add(book())
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")

    const committed = await manager.execute(async () => "empty")

    expect(committed.value).toBe("empty")
    expect(committed.facts).toEqual([])
  })

  it("preserves the original ApplicationError object", async () => {
    const failure = new ApplicationError(
      "INVALID_INPUT",
      "same application error"
    )

    await expect(
      manager.execute(async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it("preserves the original DomainError object", async () => {
    const failure = new DomainError("INVALID_DOMAIN", "same domain error")

    await expect(
      manager.execute(async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it("sanitizes an unexpected driver failure at the application boundary", async () => {
    const failure = {
      code: "SQLITE_ERROR",
      message: "SELECT secret FROM /private/financial.sqlite",
    }
    const failingDatabase: SqliteDatabase = {
      execute: async () => {
        throw failure
      },
      query: async () => [],
      executeBatch: async () => undefined,
      transaction: async (work) =>
        work({
          execute: async () => {
            throw failure
          },
          query: async () => [],
          executeBatch: async () => undefined,
        }),
      readTransaction: async () => {
        throw failure
      },
      close: async () => undefined,
    }

    await expect(
      new SqliteTransactionManager(failingDatabase).execute(
        async (repositories) => {
          await repositories.books.add(book())
          return "unreachable"
        }
      )
    ).rejects.toMatchObject({
      code: "UNEXPECTED_ERROR",
      message: "SQLite operation failed",
    })
  })

  it("serializes concurrent callbacks in FIFO order", async () => {
    const order: string[] = []
    const first = manager.execute(async () => {
      order.push("first:start")
      await delay(10)
      order.push("first:end")
    })
    const second = manager.execute(async () => {
      order.push("second:start")
      order.push("second:end")
    })

    await Promise.all([first, second])

    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ])
  })

  it("keeps external queries behind the active transaction", async () => {
    let externalResolved = false
    let externalQuery: Promise<unknown[]> | undefined
    const transaction = manager.execute(async () => {
      externalQuery = database.query("SELECT 1").then(() => {
        externalResolved = true
        return []
      })
      await delay(10)
      expect(externalResolved).toBe(false)
    })

    await transaction
    await externalQuery
    expect(externalResolved).toBe(true)
  })

  it("rolls back prior writes when a later repository constraint fails", async () => {
    await expect(
      manager.execute(async (repositories) => {
        await repositories.books.add(book())
        await repositories.books.add(book())
      })
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })

    expect(
      await database.query<{ readonly count: number }>(
        "SELECT COUNT(*) AS count FROM financial_books"
      )
    ).toEqual([{ count: 0 }])
  })

  it("rolls back a partial journal write, sequence and pending facts together", async () => {
    await expect(
      manager.execute(async (repositories) => {
        await repositories.books.add(book())
        await repositories.accounts.add(account("account-1"))
        await repositories.journalEntries.reserveNextSequence("book-1" as never)
        await repositories.journalEntries.add(entryWithMissingAccount())
      })
    ).rejects.toMatchObject({ code: "UNEXPECTED_ERROR" })

    expect(
      await database.query<{
        readonly books: number
        readonly accounts: number
        readonly entries: number
        readonly postings: number
        readonly sequences: number
      }>(
        "SELECT " +
          "(SELECT COUNT(*) FROM financial_books) AS books, " +
          "(SELECT COUNT(*) FROM ledger_accounts) AS accounts, " +
          "(SELECT COUNT(*) FROM journal_entries) AS entries, " +
          "(SELECT COUNT(*) FROM postings) AS postings, " +
          "(SELECT COUNT(*) FROM journal_sequences) AS sequences"
      )
    ).toEqual([
      { books: 0, accounts: 0, entries: 0, postings: 0, sequences: 0 },
    ])

    await expect(manager.execute(async () => "empty")).resolves.toMatchObject({
      value: "empty",
      facts: [],
    })
  })

  it("restores pre-existing version, reversal link and sequence on rollback", async () => {
    await manager.execute(async (repositories) => {
      await repositories.books.add(book())
      await repositories.accounts.add(account("account-1"))
      await repositories.accounts.add(account("account-2"))
      await repositories.journalEntries.reserveNextSequence("book-1" as never)
      await repositories.journalEntries.add(persistedEntry("entry-1", "1"))
      await repositories.journalEntries.reserveNextSequence("book-1" as never)
      await repositories.journalEntries.add(
        persistedEntry("reversal-entry", "2", { reversalOf: "entry-1" })
      )
    })

    await expect(
      manager.execute(async (repositories) => {
        await expect(
          repositories.journalEntries.reserveNextSequence("book-1" as never)
        ).resolves.toBe("3")
        await repositories.journalEntries.save(
          JournalEntry.restore({
            ...persistedEntry("entry-1", "1").toSnapshot(),
            version: 1,
            reversedBy: "reversal-entry" as never,
          }),
          0
        )
        throw new Error("restore state")
      })
    ).rejects.toThrow("restore state")

    const state = await manager.execute(async (repositories) => ({
      original: await repositories.journalEntries.findById(
        journalEntryIdFromString("entry-1")
      ),
      reversal: await repositories.journalEntries.findById(
        journalEntryIdFromString("reversal-entry")
      ),
    }))
    expect(state.value.original?.toSnapshot()).toMatchObject({
      version: 0,
    })
    expect(state.value.original?.toSnapshot()).not.toHaveProperty("reversedBy")
    expect(state.value.reversal?.toSnapshot()).toMatchObject({
      reversalOf: "entry-1",
    })
    expect(
      await database.query<{ readonly sequence: string }>(
        "SELECT CAST(last_sequence AS TEXT) AS sequence FROM journal_sequences WHERE book_id = ?",
        ["book-1"]
      )
    ).toEqual([{ sequence: "2" }])
  })
})
