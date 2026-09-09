import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  DomainEventDispatcher,
  RecordExpense,
  RecordIncome,
  ReverseJournalEntry,
  SetOpeningBalance,
  type FinancialBookRepository,
  type IdGenerator,
  type JournalEntryRepository,
  type LedgerAccountRepository,
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

type CashFlowAdapter = {
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

type AdapterFactory = () => Promise<CashFlowAdapter>

const bookCommand = {
  name: "Personal book",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
}
const expenseCommand = {
  bookId: "book-1",
  accountId: "account-5",
  categoryId: "account-6",
  amountMinor: "2500",
  currency: "BRL",
  occurredOn: "2026-08-04",
  description: "Lunch",
}
const incomeCommand = {
  bookId: "book-1",
  accountId: "account-5",
  categoryId: "account-6",
  amountMinor: "2500",
  currency: "BRL",
  occurredOn: "2026-08-04",
  description: "Salary",
}
const openingCommand = {
  bookId: "book-1",
  accountId: "account-5",
  amountMinor: "10000",
  currency: "BRL",
  occurredOn: "2026-08-04",
  description: "Opening balance",
}

function setupDispatcher(
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
    dispatcher: setupDispatcher(ids, publisher),
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
    dispatcher: setupDispatcher(ids, publisher),
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
  work: (adapter: CashFlowAdapter) => Promise<T>
): Promise<T> {
  const adapter = await factory()
  try {
    return await work(adapter)
  } finally {
    await adapter.close()
  }
}

async function createBook(adapter: CashFlowAdapter): Promise<void> {
  const result = await new CreateFinancialBook(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute(bookCommand)
  expect(result).toMatchObject({ ok: true, value: { id: "book-1" } })
  adapter.publisher.clear()
}

async function createFinancialAccount(
  adapter: CashFlowAdapter,
  kind: "ASSET" | "LIABILITY" = "ASSET",
  name = kind === "ASSET" ? "Checking" : "Credit card"
): Promise<void> {
  const result = await new CreateFinancialAccount(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute({ bookId: "book-1", name, kind })
  expect(result).toMatchObject({ ok: true, value: { bookId: "book-1", kind } })
  adapter.publisher.clear()
}

async function createExpenseCategory(adapter: CashFlowAdapter): Promise<void> {
  const result = await new CreateExpenseCategory(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute({
    bookId: "book-1",
    name: "Food",
    kind: "EXPENSE",
    iconKey: "label-dollar",
    colorHex: "f43f5e",
  })
  expect(result).toMatchObject({
    ok: true,
    value: { bookId: "book-1", kind: "EXPENSE" },
  })
  adapter.publisher.clear()
}

async function createIncomeCategory(adapter: CashFlowAdapter): Promise<void> {
  const result = await new CreateIncomeCategory(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute({
    bookId: "book-1",
    name: "Salary",
    kind: "INCOME",
    iconKey: "label-dollar",
    colorHex: "10b981",
  })
  expect(result).toMatchObject({
    ok: true,
    value: { bookId: "book-1", kind: "INCOME" },
  })
  adapter.publisher.clear()
}

async function preparedExpense(adapter: CashFlowAdapter): Promise<void> {
  await createBook(adapter)
  await createFinancialAccount(adapter)
  await createExpenseCategory(adapter)
}

async function preparedIncome(adapter: CashFlowAdapter): Promise<void> {
  await createBook(adapter)
  await createFinancialAccount(adapter)
  await createIncomeCategory(adapter)
}

async function preparedOpening(
  adapter: CashFlowAdapter,
  kind: "ASSET" | "LIABILITY" = "ASSET"
): Promise<void> {
  await createBook(adapter)
  await createFinancialAccount(adapter, kind)
}

async function expectNoEntry(
  adapter: CashFlowAdapter,
  id = "entry-1"
): Promise<void> {
  await expect(adapter.journalEntries.findById(id as never)).resolves.toBeNull()
  expect(adapter.publisher.events).toEqual([])
}

function expense(adapter: CashFlowAdapter) {
  return new RecordExpense(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

function income(adapter: CashFlowAdapter) {
  return new RecordIncome(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

function opening(adapter: CashFlowAdapter) {
  return new SetOpeningBalance(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

function defineCashFlowContracts(name: string, factory: AdapterFactory): void {
  describe(name, () => {
    it("posts expense with category debit and account credit", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        const result = await expense(adapter).execute(expenseCommand)
        expect(result).toMatchObject({
          ok: true,
          value: { id: "entry-1", description: "Lunch", currency: "BRL" },
        })
        const saved = await adapter.journalEntries.findById("entry-1" as never)
        expect(
          saved?.postings.map(({ accountId, amount }) => ({
            accountId,
            amount: amount.amountMinor,
          }))
        ).toEqual([
          { accountId: "account-6", amount: 2500n },
          { accountId: "account-5", amount: -2500n },
        ])
      }))

    it("publishes exact expense posting amounts", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        await expense(adapter).execute(expenseCommand)
        expect(adapter.publisher.events[0]).toMatchObject({
          type: "JournalEntryPosted",
          payload: {
            postings: [
              { accountId: "account-6", amountMinor: "2500" },
              { accountId: "account-5", amountMinor: "-2500" },
            ],
          },
        })
        expect(() => JSON.stringify(adapter.publisher.events[0])).not.toThrow()
      }))

    it("rejects an INCOME category for expense", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        await createIncomeCategory(adapter)
        const result = await expense(adapter).execute({
          ...expenseCommand,
          categoryId: "account-7",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a non-financial expense account", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        const result = await expense(adapter).execute({
          ...expenseCommand,
          accountId: "account-1",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects non-positive expense amounts without writes", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        for (const amountMinor of ["0", "-1"]) {
          const result = await expense(adapter).execute({
            ...expenseCommand,
            amountMinor,
          })
          expect(result).toMatchObject({
            ok: false,
            error: { code: "NON_POSITIVE_AMOUNT" },
          })
        }
        await expectNoEntry(adapter)
      }))

    it("rejects an incompatible expense currency", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        const result = await expense(adapter).execute({
          ...expenseCommand,
          currency: "USD",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "CURRENCY_MISMATCH" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an inactive expense account", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        const account = await adapter.accounts.findById("account-5" as never)
        account?.archive()
        await adapter.accounts.save(account!, 0)
        adapter.publisher.clear()
        const result = await expense(adapter).execute(expenseCommand)
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_STATUS" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an empty expense description", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        const result = await expense(adapter).execute({
          ...expenseCommand,
          description: "   ",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_JOURNAL_DESCRIPTION" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a missing expense category", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter)
        const result = await expense(adapter).execute({
          ...expenseCommand,
          categoryId: "category-missing",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        await expectNoEntry(adapter)
      }))

    it("posts income with account debit and category credit", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        const result = await income(adapter).execute(incomeCommand)
        expect(result).toMatchObject({
          ok: true,
          value: { id: "entry-1", description: "Salary", currency: "BRL" },
        })
        const saved = await adapter.journalEntries.findById("entry-1" as never)
        expect(
          saved?.postings.map(({ accountId, amount }) => ({
            accountId,
            amount: amount.amountMinor,
          }))
        ).toEqual([
          { accountId: "account-5", amount: 2500n },
          { accountId: "account-6", amount: -2500n },
        ])
      }))

    it("publishes exact income posting amounts", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        await income(adapter).execute(incomeCommand)
        expect(adapter.publisher.events[0]).toMatchObject({
          type: "JournalEntryPosted",
          payload: {
            postings: [
              { accountId: "account-5", amountMinor: "2500" },
              { accountId: "account-6", amountMinor: "-2500" },
            ],
          },
        })
        expect(() => JSON.stringify(adapter.publisher.events[0])).not.toThrow()
      }))

    it("rejects an EXPENSE category for income", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        await createExpenseCategory(adapter)
        const result = await income(adapter).execute({
          ...incomeCommand,
          categoryId: "account-7",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a non-financial income account", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        const result = await income(adapter).execute({
          ...incomeCommand,
          accountId: "account-1",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects non-positive income amounts without writes", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        for (const amountMinor of ["0", "-1"]) {
          const result = await income(adapter).execute({
            ...incomeCommand,
            amountMinor,
          })
          expect(result).toMatchObject({
            ok: false,
            error: { code: "NON_POSITIVE_AMOUNT" },
          })
        }
        await expectNoEntry(adapter)
      }))

    it("rejects an incompatible income currency", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        const result = await income(adapter).execute({
          ...incomeCommand,
          currency: "USD",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "CURRENCY_MISMATCH" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an inactive income account", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        const account = await adapter.accounts.findById("account-5" as never)
        account?.archive()
        await adapter.accounts.save(account!, 0)
        adapter.publisher.clear()
        const result = await income(adapter).execute(incomeCommand)
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_STATUS" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an empty income description", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        const result = await income(adapter).execute({
          ...incomeCommand,
          description: "   ",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_JOURNAL_DESCRIPTION" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a missing income category", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedIncome(adapter)
        const result = await income(adapter).execute({
          ...incomeCommand,
          categoryId: "category-missing",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a second active opening balance", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        await expect(
          opening(adapter).execute(openingCommand)
        ).resolves.toMatchObject({ ok: true })
        adapter.publisher.clear()
        const result = await opening(adapter).execute({
          ...openingCommand,
          amountMinor: "20000",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "OPENING_BALANCE_ALREADY_SET" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("allows a replacement after the previous opening is reversed", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        await opening(adapter).execute(openingCommand)
        const reversal = await new ReverseJournalEntry(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          journalEntryId: "entry-1",
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Reverse opening",
        })
        expect(reversal).toMatchObject({ ok: true })
        await expect(
          opening(adapter).execute({ ...openingCommand, amountMinor: "20000" })
        ).resolves.toMatchObject({ ok: true, value: { id: "entry-3" } })
      }))

    it("isolates opening balances by account and book", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        await createFinancialAccount(adapter, "ASSET", "Savings")
        await expect(
          opening(adapter).execute(openingCommand)
        ).resolves.toMatchObject({ ok: true })
        await expect(
          opening(adapter).execute({
            ...openingCommand,
            accountId: "account-6",
          })
        ).resolves.toMatchObject({ ok: true })
        const secondBook = await new CreateFinancialBook(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids
        ).execute({ name: "Second", baseCurrency: "BRL", timezone: "UTC" })
        expect(secondBook).toMatchObject({ ok: true, value: { id: "book-2" } })
        await new CreateFinancialAccount(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids
        ).execute({ bookId: "book-2", name: "Other cash", kind: "ASSET" })
        await expect(
          opening(adapter).execute({
            ...openingCommand,
            bookId: "book-2",
            accountId: "account-11",
          })
        ).resolves.toMatchObject({ ok: true })
      }))

    it("posts an ASSET opening balance with debit sign", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter, "ASSET")
        await expect(
          opening(adapter).execute(openingCommand)
        ).resolves.toMatchObject({ ok: true, value: { id: "entry-1" } })
        const saved = await adapter.journalEntries.findById("entry-1" as never)
        expect(
          saved?.postings.map(({ accountId, amount }) => ({
            accountId,
            amount: amount.amountMinor,
          }))
        ).toEqual([
          { accountId: "account-5", amount: 10000n },
          { accountId: "account-1", amount: -10000n },
        ])
      }))

    it("posts a LIABILITY opening balance with credit sign", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter, "LIABILITY")
        await opening(adapter).execute(openingCommand)
        const saved = await adapter.journalEntries.findById("entry-1" as never)
        expect(
          saved?.postings.map(({ accountId, amount }) => ({
            accountId,
            amount: amount.amountMinor,
          }))
        ).toEqual([
          { accountId: "account-5", amount: -10000n },
          { accountId: "account-1", amount: 10000n },
        ])
      }))

    it("publishes one serializable opening entry event after commit", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        const result = await opening(adapter).execute(openingCommand)
        expect(result.ok).toBe(true)
        expect(adapter.publisher.events).toHaveLength(1)
        expect(adapter.publisher.events[0]).toMatchObject({
          type: "JournalEntryPosted",
          aggregateId: "entry-1",
          payload: {
            postings: [{ amountMinor: "10000" }, { amountMinor: "-10000" }],
          },
        })
        expect(() => JSON.stringify(adapter.publisher.events[0])).not.toThrow()
      }))

    it("rejects non-positive opening amounts without writes", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        for (const amountMinor of ["0", "-1"]) {
          const result = await opening(adapter).execute({
            ...openingCommand,
            amountMinor,
          })
          expect(result).toMatchObject({
            ok: false,
            error: { code: "NON_POSITIVE_AMOUNT" },
          })
        }
        await expectNoEntry(adapter)
      }))

    it("rejects an opening currency different from the book", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        const result = await opening(adapter).execute({
          ...openingCommand,
          currency: "USD",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "CURRENCY_MISMATCH" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a category or system account as opening target", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const result = await opening(adapter).execute({
          ...openingCommand,
          accountId: "account-1",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects an inactive opening target", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedOpening(adapter)
        const account = await adapter.accounts.findById("account-5" as never)
        account?.archive()
        await adapter.accounts.save(account!, 0)
        adapter.publisher.clear()
        const result = await opening(adapter).execute(openingCommand)
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_STATUS" },
        })
        await expectNoEntry(adapter)
      }))

    it("rejects a missing opening target", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const result = await opening(adapter).execute({
          ...openingCommand,
          accountId: "account-missing",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        await expectNoEntry(adapter)
      }))
  })
}

defineCashFlowContracts("cash flow use cases: memory", memoryFactory)
defineCashFlowContracts("cash flow use cases: sqlite", sqliteFactory)
