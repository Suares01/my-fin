import type {
  FinancialBookRepository,
  JournalEntryRepository,
  LedgerAccountRepository,
  LedgerQueries,
} from "@workspace/application"
import {
  FinancialBook,
  JournalEntry,
  LedgerAccount,
  LocalDate,
  type LedgerAccountKind,
} from "@workspace/domain"
import {
  InMemoryFinancialBookRepository,
  InMemoryJournalEntryRepository,
  InMemoryLedgerAccountRepository,
  InMemoryLedgerQueries,
  InMemoryStore,
} from "@workspace/infrastructure-memory"
import { describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type PersistenceAdapter = {
  readonly books: FinancialBookRepository
  readonly accounts: LedgerAccountRepository
  readonly journalEntries: JournalEntryRepository
  readonly queries: LedgerQueries
  close(): Promise<void>
}

type AdapterFactory = () => Promise<PersistenceAdapter>

const bookId = "book-1" as never

function book(id = "book-1", currency = "BRL", version = 0): FinancialBook {
  return FinancialBook.restore({
    id: id as never,
    name: id,
    baseCurrency: currency,
    timezone: "America/Sao_Paulo",
    version,
  })
}

function account(
  id: string,
  kind: LedgerAccountKind = "ASSET",
  currentBookId = bookId,
  systemPurpose?: "OPENING_BALANCE",
  version = 0
): LedgerAccount {
  return LedgerAccount.restore({
    id: id as never,
    bookId: currentBookId,
    name: id,
    normalizedName: id,
    kind,
    status: "ACTIVE",
    ...(systemPurpose === undefined ? {} : { systemPurpose }),
    version,
  })
}

function entry(
  id = "entry-1",
  accountId = "account-1",
  amountMinor = 100n,
  sequence = "1",
  currentBookId = bookId,
  counterAccountId = "account-2",
  reversalOf?: string,
  reversedBy?: string,
  version = 0
): JournalEntry {
  return JournalEntry.restore({
    id: id as never,
    bookId: currentBookId,
    occurredOn: "2026-08-04",
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
    ...(reversedBy === undefined ? {} : { reversedBy: reversedBy as never }),
    version,
  })
}

async function withAdapter<T>(
  factory: AdapterFactory,
  work: (adapter: PersistenceAdapter) => Promise<T>
): Promise<T> {
  const adapter = await factory()
  try {
    return await work(adapter)
  } finally {
    await adapter.close()
  }
}

const memoryFactory: AdapterFactory = async () => {
  const store = new InMemoryStore()
  return {
    books: new InMemoryFinancialBookRepository(store),
    accounts: new InMemoryLedgerAccountRepository(store),
    journalEntries: new InMemoryJournalEntryRepository(store),
    queries: new InMemoryLedgerQueries(store),
    close: async () => undefined,
  }
}

const sqliteFactory: AdapterFactory = async () => {
  const database = new BetterSqliteDatabase()
  await initializeSqliteDatabase(database, { inMemory: true })
  return {
    books: new SqliteFinancialBookRepository(database),
    accounts: new SqliteLedgerAccountRepository(database),
    journalEntries: new SqliteJournalEntryRepository(database),
    queries: new SqliteLedgerQueries(database),
    close: () => database.close(),
  }
}

async function seedBook(
  adapter: PersistenceAdapter,
  id = "book-1",
  currency = "BRL"
): Promise<void> {
  await adapter.books.add(book(id, currency))
}

async function seedEntryAccounts(
  adapter: PersistenceAdapter,
  targetKind: LedgerAccountKind = "ASSET",
  targetId = "account-1",
  counterId = "account-2",
  currentBookId = bookId
): Promise<void> {
  await adapter.accounts.add(account(targetId, targetKind, currentBookId))
  await adapter.accounts.add(account(counterId, "EQUITY", currentBookId))
}

function definePersistenceContracts(
  name: string,
  factory: AdapterFactory
): void {
  describe(name, () => {
    it("adds and finds a financial book with its snapshot intact", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await expect(adapter.books.findById(bookId)).resolves.toMatchObject({
          id: "book-1",
          name: "book-1",
          baseCurrency: { code: "BRL" },
          timezone: "America/Sao_Paulo",
          version: 0,
        })
      }))

    it("returns a fresh book instance for each find", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        const first = await adapter.books.findById(bookId)
        const second = await adapter.books.findById(bookId)
        expect(first).not.toBe(second)
        expect(first?.toSnapshot()).toEqual(second?.toSnapshot())
      }))

    it("saves a financial book with the expected optimistic version", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        const updated = book("book-1", "BRL", 1)
        await adapter.books.save(updated, 0)
        await expect(adapter.books.findById(bookId)).resolves.toMatchObject({
          name: "book-1",
          version: 1,
        })
      }))

    it("distinguishes a missing book on save", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          adapter.books.save(book("missing", "BRL", 1), 0)
        ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" })
      }))

    it("distinguishes a book version conflict on save", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await expect(
          adapter.books.save(book("book-1", "BRL", 1), 1)
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
        await expect(adapter.books.findById(bookId)).resolves.toMatchObject({
          version: 0,
        })
      }))

    it("rejects a book with a non-zero version on add", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          adapter.books.add(book("book-1", "BRL", 1))
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
      }))

    it("preserves a book snapshot after a failed update", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await expect(
          adapter.books.save(book("book-1", "BRL", 2), 0)
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
        await expect(adapter.books.findById(bookId)).resolves.toMatchObject({
          name: "book-1",
          version: 0,
        })
      }))

    it("adds and finds all current ledger account fields", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        const original = account(
          "account-1",
          "LIABILITY",
          bookId,
          "OPENING_BALANCE"
        )
        await adapter.accounts.add(original)
        const found = await adapter.accounts.findById("account-1" as never)
        expect(found?.toSnapshot()).toEqual(original.toSnapshot())
      }))

    it("returns null for a missing ledger account", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          adapter.accounts.findById("missing" as never)
        ).resolves.toBeNull()
      }))

    it("returns a fresh ledger account instance for each find", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(account("account-1"))
        const first = await adapter.accounts.findById("account-1" as never)
        const second = await adapter.accounts.findById("account-1" as never)
        expect(first).not.toBe(second)
        expect(first?.toSnapshot()).toEqual(second?.toSnapshot())
      }))

    it("filters system-purpose lookup by book", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter, "book-1")
        await seedBook(adapter, "book-2")
        await adapter.accounts.add(
          account("opening-1", "EQUITY", "book-1" as never, "OPENING_BALANCE")
        )
        await adapter.accounts.add(
          account("opening-2", "EQUITY", "book-2" as never, "OPENING_BALANCE")
        )
        await expect(
          adapter.accounts.findBySystemPurpose(bookId, "OPENING_BALANCE")
        ).resolves.toMatchObject({ id: "opening-1" })
      }))

    it("filters name existence by book and kind", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter, "book-1")
        await seedBook(adapter, "book-2")
        await adapter.accounts.add(account("account-1", "ASSET", bookId))
        await expect(
          adapter.accounts.existsWithName(bookId, "ASSET", "account-1")
        ).resolves.toBe(true)
        await expect(
          adapter.accounts.existsWithName(
            "book-2" as never,
            "ASSET",
            "account-1"
          )
        ).resolves.toBe(false)
        await expect(
          adapter.accounts.existsWithName(bookId, "LIABILITY", "account-1")
        ).resolves.toBe(false)
      }))

    it("rejects changing an account kind while preserving the optimistic version contract", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(account("account-1"))
        await expect(
          adapter.accounts.save(
            account("account-1", "LIABILITY", bookId, undefined, 1),
            0
          )
        ).rejects.toMatchObject({ code: "IMMUTABLE_ACCOUNT_KIND" })
        await expect(
          adapter.accounts.findById("account-1" as never)
        ).resolves.toMatchObject({ kind: "ASSET", version: 0 })
      }))

    it("distinguishes missing and conflicting account saves", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          adapter.accounts.save(
            account("missing", "ASSET", bookId, undefined, 1),
            0
          )
        ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" })
        await seedBook(adapter)
        await adapter.accounts.add(account("account-1"))
        await expect(
          adapter.accounts.save(
            account("account-1", "ASSET", bookId, undefined, 1),
            1
          )
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
      }))

    it("rejects a non-zero version account on add", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await expect(
          adapter.accounts.add(
            account("account-1", "ASSET", bookId, undefined, 1)
          )
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
      }))

    it("rejects a duplicate system purpose in one book", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(
          account("opening-1", "EQUITY", bookId, "OPENING_BALANCE")
        )
        await expect(
          adapter.accounts.add(
            account("opening-2", "EQUITY", bookId, "OPENING_BALANCE")
          )
        ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
      }))

    it("preserves an account after a failed update", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(account("account-1"))
        await expect(
          adapter.accounts.save(
            account("account-1", "LIABILITY", bookId, undefined, 2),
            0
          )
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
        await expect(
          adapter.accounts.findById("account-1" as never)
        ).resolves.toMatchObject({ kind: "ASSET", version: 0 })
      }))

    it("adds and hydrates a journal entry with ordered postings", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await seedEntryAccounts(adapter)
        const original = entry()
        await adapter.journalEntries.add(original)
        const found = await adapter.journalEntries.findById("entry-1" as never)
        expect(found?.toSnapshot()).toEqual(original.toSnapshot())
        expect(found?.postings.map((posting) => posting.id)).toEqual([
          "entry-1-posting",
          "entry-1-counter",
        ])
      }))

    it("returns null for a missing journal entry", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          adapter.journalEntries.findById("missing" as never)
        ).resolves.toBeNull()
      }))

    it("finds only an active opening balance in the requested book", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(account("account-1"))
        await adapter.accounts.add(
          account("opening-account", "EQUITY", bookId, "OPENING_BALANCE")
        )
        await adapter.journalEntries.add(
          entry(
            "opening-entry",
            "account-1",
            100n,
            "1",
            bookId,
            "opening-account"
          )
        )
        await expect(
          adapter.journalEntries.findActiveOpeningBalanceByAccount(
            bookId,
            "account-1" as never
          )
        ).resolves.toMatchObject({ id: "opening-entry" })
      }))

    it("excludes a reversed opening balance", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(account("account-1"))
        await adapter.accounts.add(
          account("opening-account", "EQUITY", bookId, "OPENING_BALANCE")
        )
        await adapter.journalEntries.add(
          entry(
            "opening-entry",
            "account-1",
            100n,
            "1",
            bookId,
            "opening-account"
          )
        )
        await adapter.journalEntries.add(
          entry(
            "reversal-entry",
            "account-1",
            -100n,
            "2",
            bookId,
            "opening-account",
            "opening-entry"
          )
        )
        await adapter.journalEntries.save(
          entry(
            "opening-entry",
            "account-1",
            100n,
            "1",
            bookId,
            "opening-account",
            undefined,
            "reversal-entry",
            1
          ),
          0
        )
        await expect(
          adapter.journalEntries.findActiveOpeningBalanceByAccount(
            bookId,
            "account-1" as never
          )
        ).resolves.toBeNull()
      }))

    it("reserves strictly increasing sequences", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await expect(
          adapter.journalEntries.reserveNextSequence(bookId)
        ).resolves.toBe("1")
        await expect(
          adapter.journalEntries.reserveNextSequence(bookId)
        ).resolves.toBe("2")
      }))

    it("reserves sequences independently per book", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter, "book-1")
        await seedBook(adapter, "book-2")
        await expect(
          adapter.journalEntries.reserveNextSequence(bookId)
        ).resolves.toBe("1")
        await expect(
          adapter.journalEntries.reserveNextSequence("book-2" as never)
        ).resolves.toBe("1")
      }))

    it("saves a journal reversal link with the expected version", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await seedEntryAccounts(adapter)
        await adapter.journalEntries.add(entry("entry-1"))
        await adapter.journalEntries.add(
          entry("entry-2", "account-1", -100n, "2")
        )
        await adapter.journalEntries.save(
          entry(
            "entry-1",
            "account-1",
            100n,
            "1",
            bookId,
            "account-2",
            undefined,
            "entry-2",
            1
          ),
          0
        )
        await expect(
          adapter.journalEntries.findById("entry-1" as never)
        ).resolves.toMatchObject({ reversedBy: "entry-2", version: 1 })
      }))

    it("distinguishes missing and conflicting journal saves", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          adapter.journalEntries.save(
            entry(
              "missing",
              "account-1",
              100n,
              "1",
              bookId,
              "account-2",
              undefined,
              undefined,
              1
            ),
            0
          )
        ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" })
        await seedBook(adapter)
        await seedEntryAccounts(adapter)
        await adapter.journalEntries.add(entry())
        await expect(
          adapter.journalEntries.save(
            entry(
              "entry-1",
              "account-1",
              100n,
              "1",
              bookId,
              "account-2",
              undefined,
              undefined,
              1
            ),
            1
          )
        ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
      }))

    it("limits a balance by date through the shared query contract", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await seedEntryAccounts(adapter)
        await adapter.journalEntries.add(
          entry("entry-before", "account-1", 100n, "1")
        )
        const after = JournalEntry.restore({
          ...entry("entry-after", "account-1", 900n, "2").toSnapshot(),
          occurredOn: "2026-08-05",
        })
        await adapter.journalEntries.add(after)
        const result = await adapter.queries.getAccountBalance({
          bookId,
          accountId: "account-1" as never,
          asOf: LocalDate.parse("2026-08-04"),
        })
        expect(result).toMatchObject({
          amountMinor: "100",
          currency: "BRL",
          asOf: "2026-08-04",
        })
      }))

    it("returns zero in the book currency for an empty account", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await adapter.accounts.add(account("empty-account"))
        await expect(
          adapter.queries.getAccountBalance({
            bookId,
            accountId: "empty-account" as never,
          })
        ).resolves.toMatchObject({ amountMinor: "0", currency: "BRL" })
      }))

    it.each([
      ["ASSET", "100"],
      ["LIABILITY", "-100"],
      ["INCOME", "-100"],
      ["EXPENSE", "100"],
      ["EQUITY", "-100"],
    ] as const)(
      "returns the specified normal sign for %s",
      async (kind, expected) =>
        withAdapter(factory, async (adapter) => {
          await seedBook(adapter)
          await seedEntryAccounts(
            adapter,
            kind,
            `account-${kind}`,
            "counter-account"
          )
          await adapter.journalEntries.add(
            entry(
              `entry-${kind}`,
              `account-${kind}`,
              100n,
              "1",
              bookId,
              "counter-account"
            )
          )
          await expect(
            adapter.queries.getAccountBalance({
              bookId,
              accountId: `account-${kind}` as never,
            })
          ).resolves.toMatchObject({ amountMinor: expected })
        })
    )

    it("transports large monetary values as exact strings", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter)
        await seedEntryAccounts(adapter)
        await adapter.journalEntries.add(
          entry("entry-large", "account-1", 9007199254740993n, "1")
        )
        const result = await adapter.queries.getAccountBalance({
          bookId,
          accountId: "account-1" as never,
        })
        expect(result.amountMinor).toBe("9007199254740993")
      }))

    it("isolates query results by book", async () =>
      withAdapter(factory, async (adapter) => {
        await seedBook(adapter, "book-1", "BRL")
        await seedBook(adapter, "book-2", "USD")
        await seedEntryAccounts(
          adapter,
          "ASSET",
          "account-main",
          "counter-main",
          bookId
        )
        await seedEntryAccounts(
          adapter,
          "ASSET",
          "account-foreign",
          "counter-foreign",
          "book-2" as never
        )
        await adapter.journalEntries.add(
          entry("entry-main", "account-main", 100n, "1", bookId, "counter-main")
        )
        await adapter.journalEntries.add(
          entry(
            "entry-foreign",
            "account-foreign",
            900n,
            "1",
            "book-2" as never,
            "counter-foreign"
          )
        )
        await expect(
          adapter.queries.getAccountBalance({
            bookId,
            accountId: "account-main" as never,
          })
        ).resolves.toMatchObject({ amountMinor: "100", currency: "BRL" })
      }))
  })
}

definePersistenceContracts(
  "repository and query contracts: memory",
  memoryFactory
)
definePersistenceContracts(
  "repository and query contracts: sqlite",
  sqliteFactory
)
