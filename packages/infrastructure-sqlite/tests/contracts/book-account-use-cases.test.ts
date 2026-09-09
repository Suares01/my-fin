import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  DomainEventDispatcher,
  type FinancialBookRepository,
  type JournalEntryRepository,
  type LedgerAccountRepository,
  type RepositoryContext,
  type TransactionManager,
} from "@workspace/application"
import { Result } from "@workspace/domain"
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
import { SqliteTransactionManager } from "../../src/transaction/sqlite-transaction-manager.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type UseCaseAdapter = {
  readonly transactionManager: TransactionManager
  readonly dispatcher: DomainEventDispatcher
  readonly ids: SequentialIdGenerator
  readonly publisher: CollectingDomainEventPublisher
  readonly books: FinancialBookRepository
  readonly accounts: LedgerAccountRepository
  readonly journalEntries: JournalEntryRepository
  close(): Promise<void>
}

type AdapterFactory = () => Promise<UseCaseAdapter>

const validBook = {
  name: "  Personal book  ",
  baseCurrency: "BRL",
  timezone: "  America/Sao_Paulo  ",
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
    dispatcher: createDispatcher(ids, publisher),
    ids,
    publisher,
    books: new SqliteFinancialBookRepository(database),
    accounts: new SqliteLedgerAccountRepository(database),
    journalEntries: new SqliteJournalEntryRepository(database),
    close: () => database.close(),
  }
}

async function withAdapter<T>(
  factory: AdapterFactory,
  work: (adapter: UseCaseAdapter) => Promise<T>
): Promise<T> {
  const adapter = await factory()
  try {
    return await work(adapter)
  } finally {
    await adapter.close()
  }
}

function createBookUseCase(
  adapter: UseCaseAdapter,
  manager = adapter.transactionManager
): CreateFinancialBook {
  return new CreateFinancialBook(manager, adapter.dispatcher, adapter.ids)
}

function createAccountUseCase(adapter: UseCaseAdapter): CreateFinancialAccount {
  return new CreateFinancialAccount(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  )
}

function createIncomeUseCase(
  adapter: UseCaseAdapter
): Pick<CreateIncomeCategory, "execute"> {
  const useCase = new CreateIncomeCategory(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  )
  return {
    execute: (input) =>
      useCase.execute({ ...input, iconKey: "label-dollar", colorHex: "10b981" }),
  }
}

function createExpenseUseCase(
  adapter: UseCaseAdapter
): Pick<CreateExpenseCategory, "execute"> {
  const useCase = new CreateExpenseCategory(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  )
  return {
    execute: (input) =>
      useCase.execute({ ...input, iconKey: "label-dollar", colorHex: "f43f5e" }),
  }
}

async function createBook(adapter: UseCaseAdapter): Promise<void> {
  const result = await createBookUseCase(adapter).execute(validBook)
  expect(result).toEqual(
    Result.ok({
      id: "book-1",
      name: "Personal book",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      version: 0,
    })
  )
}

async function expectEmpty(adapter: UseCaseAdapter): Promise<void> {
  await expect(adapter.books.findById("book-1" as never)).resolves.toBeNull()
  await expect(
    adapter.accounts.findById("account-1" as never)
  ).resolves.toBeNull()
  expect(adapter.publisher.events).toEqual([])
}

function defineBookAccountContracts(
  name: string,
  factory: AdapterFactory
): void {
  describe(name, () => {
    it("creates the book and four exact system accounts", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          adapter.books.findById("book-1" as never)
        ).resolves.toMatchObject({
          name: "Personal book",
          baseCurrency: { code: "BRL" },
        })
        const purposes = await Promise.all(
          ["account-1", "account-2", "account-3", "account-4"].map((id) =>
            adapter.accounts.findById(id as never)
          )
        )
        expect(
          purposes.map((account) => ({
            systemPurpose: account?.systemPurpose,
            kind: account?.kind,
          }))
        ).toEqual([
          { systemPurpose: "OPENING_BALANCE", kind: "EQUITY" },
          { systemPurpose: "RECONCILIATION_ADJUSTMENT", kind: "EQUITY" },
          { systemPurpose: "UNCATEGORIZED_INCOME", kind: "INCOME" },
          { systemPurpose: "UNCATEGORIZED_EXPENSE", kind: "EXPENSE" },
        ])
      }))

    it("normalizes book values in the DTO", async () =>
      withAdapter(factory, async (adapter) => {
        await expect(
          createBookUseCase(adapter).execute(validBook)
        ).resolves.toMatchObject({
          ok: true,
          value: {
            name: "Personal book",
            timezone: "America/Sao_Paulo",
            version: 0,
          },
        })
      }))

    it("publishes the book then four account events after commit", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        expect(adapter.publisher.events.map(({ type }) => type)).toEqual([
          "FinancialBookCreated",
          "LedgerAccountCreated",
          "LedgerAccountCreated",
          "LedgerAccountCreated",
          "LedgerAccountCreated",
        ])
        expect(
          adapter.publisher.events.map(({ aggregateId }) => aggregateId)
        ).toEqual([
          "book-1",
          "account-1",
          "account-2",
          "account-3",
          "account-4",
        ])
      }))

    it("publishes exact book and account payload values", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        expect(adapter.publisher.events[0]?.payload).toEqual({
          id: "book-1",
          name: "Personal book",
          baseCurrency: "BRL",
          timezone: "America/Sao_Paulo",
          version: 0,
        })
        expect(
          adapter.publisher.events.slice(1).map(({ payload }) => payload)
        ).toEqual([
          expect.objectContaining({
            id: "account-1",
            kind: "EQUITY",
            systemPurpose: "OPENING_BALANCE",
          }),
          expect.objectContaining({
            id: "account-2",
            kind: "EQUITY",
            systemPurpose: "RECONCILIATION_ADJUSTMENT",
          }),
          expect.objectContaining({
            id: "account-3",
            kind: "INCOME",
            systemPurpose: "UNCATEGORIZED_INCOME",
          }),
          expect.objectContaining({
            id: "account-4",
            kind: "EXPENSE",
            systemPurpose: "UNCATEGORIZED_EXPENSE",
          }),
        ])
      }))

    it("rejects an empty book name without writes or events", async () =>
      withAdapter(factory, async (adapter) => {
        const result = await createBookUseCase(adapter).execute({
          ...validBook,
          name: "   ",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_BOOK_NAME" },
        })
        await expectEmpty(adapter)
      }))

    it("rejects an empty timezone without writes or events", async () =>
      withAdapter(factory, async (adapter) => {
        const result = await createBookUseCase(adapter).execute({
          ...validBook,
          timezone: "   ",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_TIMEZONE" },
        })
        await expectEmpty(adapter)
      }))

    it("rejects an invalid currency without writes or events", async () =>
      withAdapter(factory, async (adapter) => {
        const result = await createBookUseCase(adapter).execute({
          ...validBook,
          baseCurrency: "brl",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_CURRENCY" },
        })
        await expectEmpty(adapter)
      }))

    it("rolls back the book and accounts after an intermediate failure", async () =>
      withAdapter(factory, async (adapter) => {
        const failingManager: TransactionManager = {
          execute<T>(work: (repositories: RepositoryContext) => Promise<T>) {
            return adapter.transactionManager.execute(async (repositories) =>
              work({
                ...repositories,
                accounts: {
                  ...repositories.accounts,
                  async add(account) {
                    await repositories.accounts.add(account)
                    throw new Error("forced account failure")
                  },
                },
              })
            )
          },
        }
        const result = await createBookUseCase(adapter, failingManager).execute(
          validBook
        )
        expect(result).toMatchObject({
          ok: false,
          error: {
            code: "UNEXPECTED_ERROR",
            message: "forced account failure",
          },
        })
        await expectEmpty(adapter)
      }))

    it("does not publish events when the transaction rejects", async () =>
      withAdapter(factory, async (adapter) => {
        const result = await createBookUseCase(adapter).execute({
          ...validBook,
          baseCurrency: "BR",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_CURRENCY" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("keeps equivalent fixed executions deterministic", async () => {
      const first = await factory()
      const second = await factory()
      try {
        const firstResult = await createBookUseCase(first).execute(validBook)
        const secondResult = await createBookUseCase(second).execute(validBook)
        expect(firstResult).toEqual(secondResult)
        expect(first.publisher.events).toEqual(second.publisher.events)
        expect(await first.books.findById("book-1" as never)).toMatchObject({
          name: "Personal book",
        })
        expect(await second.books.findById("book-1" as never)).toMatchObject({
          name: "Personal book",
        })
      } finally {
        await first.close()
        await second.close()
      }
    })

    it("creates an active ASSET account at version zero", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createAccountUseCase(adapter).execute({
            bookId: "book-1",
            name: "  Checking  ",
            kind: "ASSET",
          })
        ).resolves.toEqual({
          ok: true,
          value: {
            id: "account-5",
            bookId: "book-1",
            name: "Checking",
            kind: "ASSET",
            status: "ACTIVE",
            version: 0,
          },
        })
      }))

    it("creates a LIABILITY account with its exact event payload", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const result = await createAccountUseCase(adapter).execute({
          bookId: "book-1",
          name: "Credit card",
          kind: "LIABILITY",
        })
        expect(result.ok).toBe(true)
        expect(adapter.publisher.events.at(-1)).toMatchObject({
          type: "LedgerAccountCreated",
          aggregateId: "account-5",
          payload: { kind: "LIABILITY", version: 0 },
        })
      }))

    it("rejects an unsupported financial account kind without writes", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const result = await createAccountUseCase(adapter).execute({
          bookId: "book-1",
          name: "Food",
          kind: "EXPENSE",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
        await expect(
          adapter.accounts.findById("account-5" as never)
        ).resolves.toBeNull()
      }))

    it("rejects a missing book without exposing another book", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const result = await createAccountUseCase(adapter).execute({
          bookId: "book-missing",
          name: "Checking",
          kind: "ASSET",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
        await expect(
          adapter.accounts.findById("account-5" as never)
        ).resolves.toBeNull()
      }))

    it("rejects duplicate normalized financial account names", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createAccountUseCase(adapter).execute({
          bookId: "book-1",
          name: "Checking",
          kind: "ASSET",
        })
        adapter.publisher.clear()
        const result = await createAccountUseCase(adapter).execute({
          bookId: "book-1",
          name: "  CHECKING  ",
          kind: "ASSET",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "DUPLICATE_ENTITY" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("allows the same normalized name for another account kind", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createAccountUseCase(adapter).execute({
          bookId: "book-1",
          name: "Card",
          kind: "ASSET",
        })
        await expect(
          createAccountUseCase(adapter).execute({
            bookId: "book-1",
            name: " card ",
            kind: "LIABILITY",
          })
        ).resolves.toMatchObject({
          ok: true,
          value: { id: "account-6", kind: "LIABILITY" },
        })
      }))

    it("rejects an invalid account name without publishing", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const result = await createAccountUseCase(adapter).execute({
          bookId: "book-1",
          name: "   ",
          kind: "ASSET",
        })
        expect(result).toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_NAME" },
        })
        expect(adapter.publisher.events).toHaveLength(5)
      }))

    it("creates an active INCOME category", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createIncomeUseCase(adapter).execute({
            bookId: "book-1",
            name: "Salary",
            kind: "INCOME",
          })
        ).resolves.toMatchObject({
          ok: true,
          value: { id: "account-5", kind: "INCOME", version: 0 },
        })
      }))

    it("publishes the exact INCOME category payload", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createIncomeUseCase(adapter).execute({
          bookId: "book-1",
          name: "Salary",
          kind: "INCOME",
        })
        expect(adapter.publisher.events.at(-1)).toMatchObject({
          type: "LedgerAccountCreated",
          aggregateId: "account-5",
          payload: { name: "Salary", kind: "INCOME", version: 0 },
        })
      }))

    it("rejects a non-INCOME kind", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createIncomeUseCase(adapter).execute({
            bookId: "book-1",
            name: "Salary",
            kind: "EXPENSE",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
      }))

    it("rejects an absent book for an INCOME category", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createIncomeUseCase(adapter).execute({
            bookId: "book-missing",
            name: "Salary",
            kind: "INCOME",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
      }))

    it("rejects an empty INCOME category name", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createIncomeUseCase(adapter).execute({
            bookId: "book-1",
            name: "   ",
            kind: "INCOME",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_NAME" },
        })
      }))

    it("rejects a duplicate normalized INCOME category", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createIncomeUseCase(adapter).execute({
          bookId: "book-1",
          name: "Salary",
          kind: "INCOME",
        })
        await expect(
          createIncomeUseCase(adapter).execute({
            bookId: "book-1",
            name: " salary ",
            kind: "INCOME",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "DUPLICATE_ENTITY" },
        })
      }))

    it("creates an active EXPENSE category", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createExpenseUseCase(adapter).execute({
            bookId: "book-1",
            name: "Food",
            kind: "EXPENSE",
          })
        ).resolves.toMatchObject({
          ok: true,
          value: { id: "account-5", kind: "EXPENSE", version: 0 },
        })
      }))

    it("publishes the exact EXPENSE category payload", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createExpenseUseCase(adapter).execute({
          bookId: "book-1",
          name: "Food",
          kind: "EXPENSE",
        })
        expect(adapter.publisher.events.at(-1)).toMatchObject({
          type: "LedgerAccountCreated",
          aggregateId: "account-5",
          payload: { name: "Food", kind: "EXPENSE", version: 0 },
        })
      }))

    it("rejects a non-EXPENSE kind", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createExpenseUseCase(adapter).execute({
            bookId: "book-1",
            name: "Food",
            kind: "INCOME",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_KIND" },
        })
      }))

    it("rejects an absent book for an EXPENSE category", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createExpenseUseCase(adapter).execute({
            bookId: "book-missing",
            name: "Food",
            kind: "EXPENSE",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "ENTITY_NOT_FOUND" },
        })
      }))

    it("rejects an empty EXPENSE category name", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await expect(
          createExpenseUseCase(adapter).execute({
            bookId: "book-1",
            name: "   ",
            kind: "EXPENSE",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "INVALID_ACCOUNT_NAME" },
        })
      }))

    it("rejects a duplicate normalized EXPENSE category", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        await createExpenseUseCase(adapter).execute({
          bookId: "book-1",
          name: "Food",
          kind: "EXPENSE",
        })
        await expect(
          createExpenseUseCase(adapter).execute({
            bookId: "book-1",
            name: " food ",
            kind: "EXPENSE",
          })
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "DUPLICATE_ENTITY" },
        })
      }))
  })
}

defineBookAccountContracts("book and account use cases: memory", memoryFactory)
defineBookAccountContracts("book and account use cases: sqlite", sqliteFactory)
