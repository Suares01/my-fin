import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  DomainEventDispatcher,
  GetAccountBalance,
  RecordExpense,
  RecordIncome,
  type LedgerAccountRepository,
  type LedgerQueries,
  type TransactionManager,
} from "@workspace/application"
import {
  CollectingDomainEventPublisher,
  FixedClock,
  InMemoryLedgerAccountRepository,
  InMemoryLedgerQueries,
  InMemoryStore,
  InMemoryTransactionManager,
  SequentialIdGenerator,
} from "@workspace/infrastructure-memory"
import { describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
import { SqliteTransactionManager } from "../../src/transaction/sqlite-transaction-manager.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type QueryAdapter = {
  readonly transactionManager: TransactionManager
  readonly dispatcher: DomainEventDispatcher
  readonly ids: SequentialIdGenerator
  readonly clock: FixedClock
  readonly publisher: CollectingDomainEventPublisher
  readonly accounts: LedgerAccountRepository
  readonly queries: LedgerQueries
  close(): Promise<void>
}

type AdapterFactory = () => Promise<QueryAdapter>

const bookCommand = {
  name: "Personal book",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
}

function createDispatcher(
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
    dispatcher: createDispatcher(ids, publisher),
    ids,
    clock: new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
    publisher,
    accounts: new InMemoryLedgerAccountRepository(store),
    queries: new InMemoryLedgerQueries(store),
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
    dispatcher: createDispatcher(ids, publisher),
    ids,
    clock: new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
    publisher,
    accounts: new SqliteLedgerAccountRepository(database),
    queries: new SqliteLedgerQueries(database),
    close: () => database.close(),
  }
}

async function withAdapter<T>(
  factory: AdapterFactory,
  work: (adapter: QueryAdapter) => Promise<T>
): Promise<T> {
  const adapter = await factory()
  try {
    return await work(adapter)
  } finally {
    await adapter.close()
  }
}

async function createBook(adapter: QueryAdapter): Promise<void> {
  const result = await new CreateFinancialBook(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute(bookCommand)
  expect(result).toMatchObject({ ok: true, value: { id: "book-1" } })
  adapter.publisher.clear()
}

async function createFinancialAccount(
  adapter: QueryAdapter,
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

async function createExpenseCategory(adapter: QueryAdapter): Promise<void> {
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

async function createIncomeCategory(adapter: QueryAdapter): Promise<void> {
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

function balance(
  adapter: QueryAdapter,
  queries = adapter.queries
): GetAccountBalance {
  return new GetAccountBalance(adapter.accounts, queries)
}

async function preparedExpense(
  adapter: QueryAdapter,
  amountMinor = "2500"
): Promise<void> {
  await createBook(adapter)
  await createFinancialAccount(adapter)
  await createExpenseCategory(adapter)
  const result = await new RecordExpense(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  ).execute({
    bookId: "book-1",
    accountId: "account-5",
    categoryId: "account-6",
    amountMinor,
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Lunch",
  })
  expect(result).toMatchObject({ ok: true, value: { id: "entry-1" } })
  adapter.publisher.clear()
}

function throwingQueries(message: string): LedgerQueries {
  return {
    getAccountBalance: async () => {
      throw new Error(message)
    },
  }
}

function defineQueryContracts(name: string, factory: AdapterFactory): void {
  describe(name, () => {
    it("returns exact serializable balance, currency and as-of date", async () =>
      withAdapter(factory, async (adapter) => {
        await preparedExpense(adapter, "9007199254740993")
        await expect(
          balance(adapter).execute({
            bookId: "book-1",
            accountId: "account-5",
            asOf: "2026-08-04",
          })
        ).resolves.toEqual({
          ok: true,
          value: {
            accountId: "account-5",
            accountName: "Checking",
            accountKind: "ASSET",
            rawBalanceMinor: "-9007199254740993",
            displayBalanceMinor: "-9007199254740993",
            asOf: "2026-08-04",
            amountMinor: "-9007199254740993",
            currency: "BRL",
          },
        })
      }))

    it("exposes a liability balance with its displayed sign", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createFinancialAccount(adapter, "LIABILITY")
        await createIncomeCategory(adapter)
        await new RecordIncome(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          accountId: "account-5",
          categoryId: "account-6",
          amountMinor: "100",
          currency: "BRL",
          occurredOn: "2026-08-01",
          description: "Charge",
        })
        await expect(
          balance(adapter).execute({ bookId: "book-1", accountId: "account-5" })
        ).resolves.toMatchObject({
          ok: true,
          value: { amountMinor: "-100", asOf: null, currency: "BRL" },
        })
      }))

    it("returns ENTITY_NOT_FOUND for a missing account without querying", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          balance(
            adapter,
            throwingQueries("missing account should not query")
          ).execute({ bookId: "book-1", accountId: "missing" })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
      }))

    it("returns ENTITY_NOT_FOUND for an account from another book without querying", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createFinancialAccount(adapter)
        await expect(
          balance(
            adapter,
            throwingQueries("cross-book query should not run")
          ).execute({ bookId: "book-2", accountId: "account-5" })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
      }))

    it("rejects an invalid as-of date with the stable date error", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createFinancialAccount(adapter)
        await expect(
          balance(
            adapter,
            throwingQueries("invalid date should stop before querying")
          ).execute({
            bookId: "book-1",
            accountId: "account-5",
            asOf: "2026-02-30",
          })
        ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_DATE" } })
      }))

    it("maps an unexpected query failure to the public error boundary", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createFinancialAccount(adapter)
        const result = await balance(
          adapter,
          throwingQueries("query failed")
        ).execute({ bookId: "book-1", accountId: "account-5" })
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe("UNEXPECTED_ERROR")
          expect(result.error.message).toBe("Financial query failed")
        }
      }))
  })
}

defineQueryContracts("memory query use cases", memoryFactory)
defineQueryContracts("sqlite query use cases", sqliteFactory)
