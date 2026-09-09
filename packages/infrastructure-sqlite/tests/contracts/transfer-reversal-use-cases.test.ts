import {
  ApplicationError,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateExpenseCategory,
  CreateIncomeCategory,
  DomainEventDispatcher,
  RecordExpense,
  ReverseJournalEntry,
  TransferMoney,
  type FinancialBookRepository,
  type IdGenerator,
  type JournalEntryRepository,
  type LedgerAccountRepository,
  type RepositoryContext,
  type TransactionManager,
} from "@workspace/application"
import {
  CollectingDomainEventPublisher,
  FixedClock,
  InMemoryFinancialBookRepository,
  InMemoryJournalEntryRepository,
  InMemoryLedgerAccountRepository,
  InMemoryStore,
  InMemoryTransactionManager,
  SequentialIdGenerator,
} from "@workspace/infrastructure-memory"
import { describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { SqliteTransactionManager } from "../../src/transaction/sqlite-transaction-manager.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type TransferAdapter = {
  readonly transactionManager: TransactionManager
  readonly dispatcher: DomainEventDispatcher
  readonly ids: IdGenerator
  readonly clock: FixedClock
  readonly publisher: CollectingDomainEventPublisher
  readonly books: FinancialBookRepository
  readonly accounts: LedgerAccountRepository
  readonly journalEntries: JournalEntryRepository
  close(): Promise<void>
}

type AdapterFactory = () => Promise<TransferAdapter>

const bookCommand = {
  name: "Personal book",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
}

function dispatcher(
  ids: SequentialIdGenerator,
  publisher: CollectingDomainEventPublisher
): DomainEventDispatcher {
  return new DomainEventDispatcher(
    new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
    ids,
    publisher
  )
}

const memoryFactory: AdapterFactory = async () => {
  const store = new InMemoryStore()
  const ids = new SequentialIdGenerator()
  const publisher = new CollectingDomainEventPublisher()
  return {
    transactionManager: new InMemoryTransactionManager(store),
    dispatcher: dispatcher(ids, publisher),
    ids,
    clock: new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
    publisher,
    books: new InMemoryFinancialBookRepository(store),
    accounts: new InMemoryLedgerAccountRepository(store),
    journalEntries: new InMemoryJournalEntryRepository(store),
    close: async () => undefined,
  }
}

const sqliteFactory: AdapterFactory = async () => {
  const database = new BetterSqliteDatabase()
  await initializeSqliteDatabase(database, { inMemory: true })
  const ids = new SequentialIdGenerator()
  const publisher = new CollectingDomainEventPublisher()
  return {
    transactionManager: new SqliteTransactionManager(database),
    dispatcher: dispatcher(ids, publisher),
    ids,
    clock: new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
    publisher,
    books: new SqliteFinancialBookRepository(database),
    accounts: new SqliteLedgerAccountRepository(database),
    journalEntries: new SqliteJournalEntryRepository(database),
    close: () => database.close(),
  }
}

async function withAdapter<T>(
  factory: AdapterFactory,
  work: (adapter: TransferAdapter) => Promise<T>
): Promise<T> {
  const adapter = await factory()
  try {
    return await work(adapter)
  } finally {
    await adapter.close()
  }
}

async function createBook(
  adapter: TransferAdapter,
  name = "Personal book"
): Promise<void> {
  const result = await new CreateFinancialBook(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute({ ...bookCommand, name })
  expect(result).toMatchObject({ ok: true })
  adapter.publisher.clear()
}

async function createAccount(
  adapter: TransferAdapter,
  bookId = "book-1",
  name = "Checking",
  kind: "ASSET" | "LIABILITY" = "ASSET"
): Promise<string> {
  const result = await new CreateFinancialAccount(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute({ bookId, name, kind })
  expect(result).toMatchObject({ ok: true })
  adapter.publisher.clear()
  return result.ok ? result.value.id : "missing"
}

async function createCategory(
  adapter: TransferAdapter,
  kind: "INCOME" | "EXPENSE"
): Promise<string> {
  const result =
    kind === "INCOME"
      ? await new CreateIncomeCategory(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids
        ).execute({
          bookId: "book-1",
          name: "Salary",
          kind,
          iconKey: "label-dollar",
          colorHex: "10b981",
        })
      : await new CreateExpenseCategory(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids
        ).execute({
          bookId: "book-1",
          name: "Food",
          kind,
          iconKey: "label-dollar",
          colorHex: "f43f5e",
        })
  expect(result).toMatchObject({ ok: true })
  adapter.publisher.clear()
  return result.ok ? result.value.id : "missing"
}

async function preparedTransfer(adapter: TransferAdapter) {
  await createBook(adapter)
  const source = await createAccount(adapter)
  const destination = await createAccount(adapter, "book-1", "Savings")
  const expense = await createCategory(adapter, "EXPENSE")
  const income = await createCategory(adapter, "INCOME")
  return { source, destination, expense, income }
}

async function preparedReverse(adapter: TransferAdapter): Promise<void> {
  await createBook(adapter)
  const account = await createAccount(adapter)
  const category = await createCategory(adapter, "EXPENSE")
  const result = await new RecordExpense(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  ).execute({
    bookId: "book-1",
    accountId: account,
    categoryId: category,
    amountMinor: "2500",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Lunch",
  })
  expect(result).toMatchObject({ ok: true, value: { id: "entry-1" } })
  adapter.publisher.clear()
}

function transfer(adapter: TransferAdapter) {
  return new TransferMoney(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

function reverse(
  adapter: TransferAdapter,
  manager = adapter.transactionManager
) {
  return new ReverseJournalEntry(
    manager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

async function expectNoEntry(
  adapter: TransferAdapter,
  id = "entry-1"
): Promise<void> {
  await expect(adapter.journalEntries.findById(id as never)).resolves.toBeNull()
  expect(adapter.publisher.events).toEqual([])
}

function conflictManager(base: TransactionManager): TransactionManager {
  return {
    execute<T>(work: (repositories: RepositoryContext) => Promise<T>) {
      return base.execute((repositories) =>
        work({
          ...repositories,
          journalEntries: {
            findById: repositories.journalEntries.findById.bind(
              repositories.journalEntries
            ),
            findActiveOpeningBalanceByAccount:
              repositories.journalEntries.findActiveOpeningBalanceByAccount.bind(
                repositories.journalEntries
              ),
            reserveNextSequence:
              repositories.journalEntries.reserveNextSequence.bind(
                repositories.journalEntries
              ),
            add: repositories.journalEntries.add.bind(
              repositories.journalEntries
            ),
            save: async () => {
              throw new ApplicationError(
                "OPTIMISTIC_CONCURRENCY_FAILURE",
                "forced conflict"
              )
            },
          },
        })
      )
    },
  }
}

function defineTransferContracts(name: string, factory: AdapterFactory): void {
  describe(name, () => {
    it("posts only source credit and destination debit", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: fixture.destination,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(result).toMatchObject({ ok: true, value: { id: "entry-1" } })
        const saved = await adapter.journalEntries.findById("entry-1" as never)
        expect(
          saved?.postings.map(({ accountId, amount }) => ({
            accountId,
            amount: amount.amountMinor,
          }))
        ).toEqual([
          { accountId: fixture.source, amount: -2500n },
          { accountId: fixture.destination, amount: 2500n },
        ])
        expect(saved?.postings.map(({ accountId }) => accountId)).not.toEqual(
          expect.arrayContaining([fixture.expense, fixture.income])
        )
      }))

    it("publishes exact transfer payload after commit", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: fixture.destination,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(adapter.publisher.events[0]).toMatchObject({
          type: "JournalEntryPosted",
          payload: {
            postings: [
              { accountId: fixture.source, amountMinor: "-2500" },
              { accountId: fixture.destination, amountMinor: "2500" },
            ],
          },
        })
        expect(() => JSON.stringify(adapter.publisher.events[0])).not.toThrow()
      }))

    it("rejects equal source and destination", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: fixture.source,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "SAME_TRANSFER_ACCOUNT" },
        })
        await expectNoEntry(adapter)
      }))

    it.each([
      ["source", "expense"],
      ["destination", "income"],
    ] as const)("rejects a non-financial %s account", async (side, invalid) =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId:
            side === "source" ? fixture[invalid] : fixture.source,
          destinationAccountId:
            side === "destination" ? fixture[invalid] : fixture.destination,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expectNoEntry(adapter)
      })
    )

    it("rejects an inactive destination", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        const destination = await adapter.accounts.findById(
          fixture.destination as never
        )
        destination?.archive()
        await adapter.accounts.save(destination!, 0)
        adapter.publisher.clear()
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: fixture.destination,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_STATUS" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an account from another book", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        await createBook(adapter, "Other book")
        const foreign = await createAccount(adapter, "book-2", "Foreign cash")
        adapter.publisher.clear()
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: foreign,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "BOOK_MISMATCH" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an incompatible currency", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: fixture.destination,
          amountMinor: "2500",
          currency: "USD",
          occurredOn: "2026-08-04",
          description: "Move savings",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "CURRENCY_MISMATCH" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an empty transfer description", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedTransfer(adapter)
        const result = await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: fixture.source,
          destinationAccountId: fixture.destination,
          amountMinor: "2500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "   ",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_JOURNAL_DESCRIPTION" },
        })
        await expectNoEntry(adapter)
      }))

    it.each(["0", "-1"] as const)(
      "rejects transfer amount %s",
      async (amountMinor) =>
        withAdapter(factory, async (adapter) => {
          const fixture = await preparedTransfer(adapter)
          const result = await transfer(adapter).execute({
            bookId: "book-1",
            sourceAccountId: fixture.source,
            destinationAccountId: fixture.destination,
            amountMinor,
            currency: "BRL",
            occurredOn: "2026-08-04",
            description: "Move savings",
          })
          expect(result).toMatchObject({
            ok: false,
            error: { code: "NON_POSITIVE_AMOUNT" },
          })
          await expectNoEntry(adapter)
        })
    )

    it("creates a reversal with opposite postings and links", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        expect(result).toMatchObject({ ok: true, value: { id: "entry-2" } })
        await expect(
          adapter.journalEntries.findById("entry-1" as never)
        ).resolves.toMatchObject({ reversedBy: "entry-2", version: 1 })
        const reversal = await adapter.journalEntries.findById(
          "entry-2" as never
        )
        expect(reversal?.toSnapshot()).toMatchObject({
          reversalOf: "entry-1",
          postings: [
            { accountId: "account-6", amountMinor: -2500n },
            { accountId: "account-5", amountMinor: 2500n },
          ],
        })
      }))

    it("publishes posted then reversed events after commit", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        expect(adapter.publisher.events.map(({ type }) => type)).toEqual([
          "JournalEntryPosted",
          "JournalEntryReversed",
        ])
        expect(adapter.publisher.events[1]?.payload).toEqual({
          bookId: "book-1",
          originalId: "entry-1",
          reversalId: "entry-2",
        })
      }))

    it("keeps every original posting field unchanged", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const before = await adapter.journalEntries.findById("entry-1" as never)
        await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        const after = await adapter.journalEntries.findById("entry-1" as never)
        expect(after?.toSnapshot().postings).toEqual(
          before?.toSnapshot().postings
        )
        expect(after?.occurredOn.value).toBe(before?.occurredOn.value)
      }))

    it("rejects a second reversal without partial state", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        adapter.publisher.clear()
        const result = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 1,
          occurredOn: "2026-08-06",
          description: "Reverse again",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "JOURNAL_ENTRY_ALREADY_REVERSED" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("rejects reversing a reversal", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        adapter.publisher.clear()
        const result = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-2",
          expectedVersion: 0,
          occurredOn: "2026-08-06",
          description: "Reverse again",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "JOURNAL_ENTRY_REVERSAL_NOT_REVERSIBLE" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("rejects a reversal before the original date", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-03",
          description: "Reverse lunch",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "REVERSAL_DATE_BEFORE_ORIGINAL" },
        })
        await expectNoEntry(adapter, "entry-2")
      }))

    it("rejects a missing journal entry", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "missing",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("rejects a missing book", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(adapter).execute({
          bookId: "missing",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("rejects an entry from another book", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(adapter).execute({
          bookId: "book-2",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("rejects an empty reversal description", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "   ",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_JOURNAL_DESCRIPTION" },
        })
        await expectNoEntry(adapter, "entry-2")
      }))

    it("rolls back a reversal after an optimistic save conflict", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedReverse(adapter)
        const result = await reverse(
          adapter,
          conflictManager(adapter.transactionManager)
        ).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse lunch",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
        })
        await expect(
          adapter.journalEntries.findById("entry-2" as never)
        ).resolves.toBeNull()
        expect(adapter.publisher.events).toEqual([])
      }))

    it("persists fixed recordedAt and monotonic sequence metadata across commands", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const account = await createAccount(adapter)
        const destination = await createAccount(adapter, "book-1", "Savings")
        const expense = await createCategory(adapter, "EXPENSE")
        const income = await createCategory(adapter, "INCOME")
        await new (await import("@workspace/application")).SetOpeningBalance(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          accountId: account,
          amountMinor: "10000",
          currency: "BRL",
          occurredOn: "2026-08-01",
          description: "Opening",
        })
        await new RecordExpense(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          accountId: account,
          categoryId: expense,
          amountMinor: "1000",
          currency: "BRL",
          occurredOn: "2026-08-02",
          description: "Expense",
        })
        await new (await import("@workspace/application")).RecordIncome(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          accountId: account,
          categoryId: income,
          amountMinor: "2000",
          currency: "BRL",
          occurredOn: "2026-08-03",
          description: "Income",
        })
        await transfer(adapter).execute({
          bookId: "book-1",
          sourceAccountId: account,
          destinationAccountId: destination,
          amountMinor: "500",
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Transfer",
        })
        await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: "entry-4",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse transfer",
        })
        const entries = await Promise.all(
          ["entry-1", "entry-2", "entry-3", "entry-4", "entry-5"].map((id) =>
            adapter.journalEntries.findById(id as never)
          )
        )
        expect(
          entries.map((item) => ({
            recordedAt: item?.recordedAt,
            sequence: item?.sequence,
          }))
        ).toEqual(
          [1, 2, 3, 4, 5].map((sequence) => ({
            recordedAt: "2026-08-04T12:00:00.000Z",
            sequence: String(sequence),
          }))
        )
      }))
  })
}

defineTransferContracts(
  "transfer and reversal use cases: memory",
  memoryFactory
)
defineTransferContracts(
  "transfer and reversal use cases: sqlite",
  sqliteFactory
)
