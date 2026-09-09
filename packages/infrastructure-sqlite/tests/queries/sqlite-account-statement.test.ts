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

function makeBook(): FinancialBook {
  return FinancialBook.restore({
    id: bookId,
    name: "book-1",
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
    version: 0,
  })
}

function makeAccount(
  id: string,
  kind: LedgerAccountKind,
  name = id
): LedgerAccount {
  return LedgerAccount.restore({
    id: id as never,
    bookId,
    name,
    normalizedName: name.toLowerCase(),
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
  accountId: string,
  amountMinor: bigint,
  sequence: string,
  occurredOn = "2026-08-04",
  reversalOf?: string
): JournalEntry {
  return JournalEntry.restore({
    id: id as never,
    bookId,
    occurredOn,
    recordedAt: `2026-08-04T${sequence.padStart(2, "0")}:00:00.000Z`,
    sequence,
    description: id,
    currency: "BRL",
    origin: reversalOf === undefined ? "MANUAL" : "SYSTEM",
    postings: [
      {
        id: `${id}-target` as never,
        accountId: accountId as never,
        amountMinor,
        currency: "BRL",
      },
      {
        id: `${id}-counter` as never,
        accountId: "counter" as never,
        amountMinor: -amountMinor,
        currency: "BRL",
      },
    ],
    ...(reversalOf === undefined ? {} : { reversalOf: reversalOf as never }),
    version: 0,
  })
}

describe("SqliteLedgerQueries.listAccountStatement", () => {
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
    await accounts.add(makeAccount("target", "ASSET"))
  })

  afterEach(async () => database.close())

  it("orders by date, decimal sequence and returns exact running balances", async () => {
    await entries.add(makeEntry("entry-9", "target", 100n, "9"))
    await entries.add(makeEntry("entry-10", "target", 200n, "10"))
    await entries.add(makeEntry("entry-11", "target", -50n, "11", "2026-08-05"))

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(result.nextKey).toBeNull()
    expect(
      result.items.map(
        ({ entryId, sequence, rawAmountMinor, runningBalanceMinor }) => ({
          entryId,
          sequence,
          rawAmountMinor,
          runningBalanceMinor,
        })
      )
    ).toEqual([
      {
        entryId: "entry-11",
        sequence: "11",
        rawAmountMinor: "-50",
        runningBalanceMinor: "250",
      },
      {
        entryId: "entry-10",
        sequence: "10",
        rawAmountMinor: "200",
        runningBalanceMinor: "300",
      },
      {
        entryId: "entry-9",
        sequence: "9",
        rawAmountMinor: "100",
        runningBalanceMinor: "100",
      },
    ])
  })

  it("fetches limit plus one, then continues without a gap or duplicate", async () => {
    await entries.add(makeEntry("entry-9", "target", 100n, "9"))
    await entries.add(makeEntry("entry-10", "target", 200n, "10"))
    await entries.add(makeEntry("entry-11", "target", 300n, "11"))

    const first = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 2,
    })
    const second = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 2,
      cursor: first.nextKey ?? undefined,
    })

    expect(first.items.map(({ entryId }) => entryId)).toEqual([
      "entry-11",
      "entry-10",
    ])
    expect(first.nextKey).toEqual({
      occurredOn: "2026-08-04",
      sequence: "10",
      postingPosition: 0,
    })
    expect(second.items.map(({ entryId }) => entryId)).toEqual(["entry-9"])
    expect(second.nextKey).toBeNull()
  })

  it("applies inclusive dates after computing the historical running balance", async () => {
    await entries.add(
      makeEntry("entry-before", "target", 100n, "1", "2026-08-01")
    )
    await entries.add(
      makeEntry("entry-in-range", "target", 50n, "2", "2026-08-04")
    )
    await entries.add(
      makeEntry("entry-after", "target", 900n, "3", "2026-08-05")
    )

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      from: { value: "2026-08-04" } as never,
      to: { value: "2026-08-04" } as never,
      limit: 10,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        entryId: "entry-in-range",
        runningBalanceMinor: "150",
      })
    )
  })

  it("returns unique counterparties ordered by name and flags reversals", async () => {
    await entries.add(makeEntry("entry-original", "target", 100n, "1"))
    await entries.add(
      makeEntry(
        "entry-reversal",
        "target",
        -100n,
        "2",
        "2026-08-05",
        "entry-original"
      )
    )

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(
      result.items.map(({ entryId, isReversal, counterpartyAccounts }) => ({
        entryId,
        isReversal,
        counterpartyAccounts,
      }))
    ).toEqual([
      {
        entryId: "entry-reversal",
        isReversal: true,
        counterpartyAccounts: [
          { id: "counter", name: "counter", kind: "EQUITY" },
        ],
      },
      {
        entryId: "entry-original",
        isReversal: false,
        counterpartyAccounts: [
          { id: "counter", name: "counter", kind: "EQUITY" },
        ],
      },
    ])
  })

  it("returns an empty page with no continuation for an account without postings", async () => {
    await accounts.add(makeAccount("empty", "ASSET"))

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "empty" as never,
      limit: 10,
    })

    expect(result).toEqual({ items: [], nextKey: null })
  })

  it("applies each date bound inclusively", async () => {
    await entries.add(
      makeEntry("entry-first", "target", 100n, "1", "2026-08-01")
    )
    await entries.add(
      makeEntry("entry-middle", "target", 50n, "2", "2026-08-04")
    )
    await entries.add(makeEntry("entry-last", "target", 25n, "3", "2026-08-05"))

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      from: { value: "2026-08-01" } as never,
      to: { value: "2026-08-05" } as never,
      limit: 10,
    })

    expect(result.items.map(({ entryId }) => entryId)).toEqual([
      "entry-last",
      "entry-middle",
      "entry-first",
    ])
  })

  it("uses posting position as the final descending tie breaker", async () => {
    await entries.add(
      JournalEntry.restore({
        id: "entry-split" as never,
        bookId,
        occurredOn: "2026-08-04",
        recordedAt: "2026-08-04T12:00:00.000Z",
        sequence: "1",
        description: "Split target",
        currency: "BRL",
        origin: "MANUAL",
        postings: [
          {
            id: "target-0" as never,
            accountId: "target" as never,
            amountMinor: 20n,
            currency: "BRL",
          },
          {
            id: "target-1" as never,
            accountId: "target" as never,
            amountMinor: 30n,
            currency: "BRL",
          },
          {
            id: "counter-split" as never,
            accountId: "counter" as never,
            amountMinor: -50n,
            currency: "BRL",
          },
        ],
        version: 0,
      })
    )

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(
      result.items.map(({ postingId, rawAmountMinor }) => ({
        postingId,
        rawAmountMinor,
      }))
    ).toEqual([
      { postingId: "target-1", rawAmountMinor: "30" },
      { postingId: "target-0", rawAmountMinor: "20" },
    ])
  })

  it("returns every statement field with the target account display sign", async () => {
    await entries.add(makeEntry("entry-fields", "target", 100n, "1"))

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(result.items[0]).toEqual({
      entryId: "entry-fields",
      postingId: "entry-fields-target",
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T01:00:00.000Z",
      sequence: "1",
      description: "entry-fields",
      rawAmountMinor: "100",
      displayAmountMinor: "100",
      runningBalanceMinor: "100",
      currency: "BRL",
      origin: "MANUAL",
      counterpartyAccounts: [
        { id: "counter", name: "counter", kind: "EQUITY" },
      ],
      isReversal: false,
      isReversed: false,
    })
  })

  it("returns multiple unique counterparties ordered by name and ID", async () => {
    await accounts.add(makeAccount("counter-z", "EQUITY", "Alpha Z"))
    await accounts.add(makeAccount("counter-a", "EQUITY", "Alpha A"))
    await accounts.add(makeAccount("counter-b", "EQUITY", "Beta"))
    await database.execute(
      "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND id = ?",
      ["Alpha", bookId, "counter-z"]
    )
    await database.execute(
      "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND id = ?",
      ["Alpha", bookId, "counter-a"]
    )
    await entries.add(
      JournalEntry.restore({
        id: "entry-multiple-counterparties" as never,
        bookId,
        occurredOn: "2026-08-04",
        recordedAt: "2026-08-04T12:00:00.000Z",
        sequence: "3",
        description: "Multiple counterparties",
        currency: "BRL",
        origin: "MANUAL",
        postings: [
          {
            id: "target-multiple" as never,
            accountId: "target" as never,
            amountMinor: 60n,
            currency: "BRL",
          },
          {
            id: "counter-z-posting" as never,
            accountId: "counter-z" as never,
            amountMinor: -20n,
            currency: "BRL",
          },
          {
            id: "counter-a-posting" as never,
            accountId: "counter-a" as never,
            amountMinor: -20n,
            currency: "BRL",
          },
          {
            id: "counter-b-posting" as never,
            accountId: "counter-b" as never,
            amountMinor: -20n,
            currency: "BRL",
          },
        ],
        version: 0,
      })
    )

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(
      result.items.find(
        ({ entryId }) => entryId === "entry-multiple-counterparties"
      )?.counterpartyAccounts
    ).toEqual([
      { id: "counter-a", name: "Alpha", kind: "EQUITY" },
      { id: "counter-z", name: "Alpha", kind: "EQUITY" },
      { id: "counter-b", name: "Beta", kind: "EQUITY" },
    ])
  })

  it("zeros the running balance after an original entry is reversed", async () => {
    await entries.add(makeEntry("entry-original-cancel", "target", 100n, "1"))
    await entries.add(
      makeEntry(
        "entry-reversal-cancel",
        "target",
        -100n,
        "2",
        "2026-08-05",
        "entry-original-cancel"
      )
    )

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(
      result.items.map(
        ({ entryId, rawAmountMinor, runningBalanceMinor, isReversal }) => ({
          entryId,
          rawAmountMinor,
          runningBalanceMinor,
          isReversal,
        })
      )
    ).toEqual([
      {
        entryId: "entry-reversal-cancel",
        rawAmountMinor: "-100",
        runningBalanceMinor: "0",
        isReversal: true,
      },
      {
        entryId: "entry-original-cancel",
        rawAmountMinor: "100",
        runningBalanceMinor: "100",
        isReversal: false,
      },
    ])
  })

  it("exposes an original entry as reversed when its link is persisted", async () => {
    await entries.add(makeEntry("entry-linked", "target", 100n, "1"))
    await entries.add(
      makeEntry(
        "entry-reversal",
        "target",
        -100n,
        "2",
        "2026-08-05",
        "entry-linked"
      )
    )
    await database.execute(
      "UPDATE journal_entries SET reversed_by_id = ? WHERE book_id = ? AND id = ?",
      ["entry-reversal", bookId, "entry-linked"]
    )

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(
      result.items.find(({ entryId }) => entryId === "entry-linked")?.isReversed
    ).toBe(true)
  })

  it("inverts displayed amounts for a liability target", async () => {
    await accounts.add(makeAccount("liability", "LIABILITY"))
    await entries.add(makeEntry("entry-liability", "liability", 100n, "1"))

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "liability" as never,
      limit: 10,
    })

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        rawAmountMinor: "100",
        displayAmountMinor: "-100",
        runningBalanceMinor: "-100",
      })
    )
  })

  it("keeps monetary values exact and uses two statements in one read snapshot", async () => {
    await entries.add(
      makeEntry("entry-large", "target", 9007199254740993n, "1")
    )
    const querySpy = vi.spyOn(database, "queryOnConnection")

    const result = await queries.listAccountStatement({
      bookId,
      accountId: "target" as never,
      limit: 10,
    })

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        rawAmountMinor: "9007199254740993",
        runningBalanceMinor: "9007199254740993",
      })
    )
    expect(querySpy).toHaveBeenCalledTimes(2)
  })
})
