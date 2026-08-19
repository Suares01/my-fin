import {
  ArchiveLedgerAccount,
  AmendJournalEntry,
  ApplicationError,
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  DomainEventDispatcher,
  RecordExpense,
  RecordIncome,
  ReactivateLedgerAccount,
  RenameLedgerAccount,
  ReverseJournalEntry,
  SetOpeningBalance,
  TransferMoney,
  type DomainEventPublisher,
  type FinancialBookRepository,
  type IdGenerator,
  type JournalBusinessDraft,
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

type Adapter = {
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

type AdapterFactory = () => Promise<Adapter>

const BOOK = {
  name: "Personal book",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
}
const RECORDED_AT = "2026-08-04T12:00:00.000Z"

function createDispatcher(
  ids: IdGenerator,
  publisher: DomainEventPublisher
): DomainEventDispatcher {
  return new DomainEventDispatcher(
    new FixedClock(RECORDED_AT, "2026-08-04"),
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
    clock: new FixedClock(RECORDED_AT, "2026-08-04"),
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
    clock: new FixedClock(RECORDED_AT, "2026-08-04"),
    publisher,
    books: new SqliteFinancialBookRepository(database),
    accounts: new SqliteLedgerAccountRepository(database),
    journalEntries: new SqliteJournalEntryRepository(database),
    close: () => database.close(),
  }
}

async function withAdapter<T>(
  factory: AdapterFactory,
  work: (adapter: Adapter) => Promise<T>
): Promise<T> {
  const adapter = await factory()
  try {
    return await work(adapter)
  } finally {
    await adapter.close()
  }
}

async function createBook(adapter: Adapter): Promise<void> {
  const result = await new CreateFinancialBook(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute(BOOK)
  if (!result.ok) throw new Error(result.error.code)
  adapter.publisher.clear()
}

async function createAccount(
  adapter: Adapter,
  name = "Checking",
  kind: "ASSET" | "LIABILITY" = "ASSET"
) {
  const result = await new CreateFinancialAccount(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids
  ).execute({ bookId: "book-1", name, kind })
  if (!result.ok) throw new Error(result.error.code)
  adapter.publisher.clear()
  return result.value
}

async function createCategory(
  adapter: Adapter,
  kind: "INCOME" | "EXPENSE",
  name = kind === "INCOME" ? "Salary" : "Food"
) {
  const result =
    kind === "INCOME"
      ? await new CreateIncomeCategory(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids
        ).execute({ bookId: "book-1", name, kind })
      : await new CreateExpenseCategory(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids
        ).execute({ bookId: "book-1", name, kind })
  if (!result.ok) throw new Error(result.error.code)
  adapter.publisher.clear()
  return result.value
}

async function preparedExpense(adapter: Adapter) {
  await createBook(adapter)
  const account = await createAccount(adapter)
  const destination = await createAccount(adapter, "Savings")
  const category = await createCategory(adapter, "EXPENSE")
  const incomeCategory = await createCategory(adapter, "INCOME")
  const result = await new RecordExpense(
    adapter.transactionManager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  ).execute({
    bookId: "book-1",
    accountId: account.id,
    categoryId: category.id,
    amountMinor: "2500",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Lunch",
  })
  if (!result.ok) throw new Error(result.error.code)
  adapter.publisher.clear()
  return {
    account,
    destination,
    category,
    incomeCategory,
    originalId: result.value.id,
  }
}

async function snapshot(adapter: Adapter, id: string) {
  const entry = await adapter.journalEntries.findById(id as never)
  if (entry === null) throw new Error(`Missing journal entry ${id}`)
  return entry.toSnapshot()
}

function amend(adapter: Adapter, manager = adapter.transactionManager) {
  return new AmendJournalEntry(
    manager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

function reverse(adapter: Adapter, manager = adapter.transactionManager) {
  return new ReverseJournalEntry(
    manager,
    adapter.dispatcher,
    adapter.ids,
    adapter.clock
  )
}

function amendCommand(
  journalEntryId: string,
  replacement: JournalBusinessDraft,
  expectedVersion = 0
) {
  return { bookId: "book-1", journalEntryId, expectedVersion, replacement }
}

function journalConflictManager(base: TransactionManager): TransactionManager {
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
                "forced journal conflict"
              )
            },
          },
        })
      )
    },
  }
}

function accountConflictManager(base: TransactionManager): TransactionManager {
  return {
    execute<T>(work: (repositories: RepositoryContext) => Promise<T>) {
      return base.execute((repositories) =>
        work({
          ...repositories,
          accounts: {
            findById: repositories.accounts.findById.bind(
              repositories.accounts
            ),
            findBySystemPurpose: repositories.accounts.findBySystemPurpose.bind(
              repositories.accounts
            ),
            existsWithName: repositories.accounts.existsWithName.bind(
              repositories.accounts
            ),
            add: repositories.accounts.add.bind(repositories.accounts),
            save: async () => {
              throw new ApplicationError(
                "OPTIMISTIC_CONCURRENCY_FAILURE",
                "forced account conflict"
              )
            },
          },
        })
      )
    },
  }
}

function replacementFor(
  variant: "OPENING_BALANCE" | "INCOME" | "EXPENSE" | "TRANSFER",
  fixture: Awaited<ReturnType<typeof preparedExpense>>
): {
  draft: JournalBusinessDraft
  postings: readonly { accountId: string; amountMinor: bigint }[]
} {
  if (variant === "OPENING_BALANCE") {
    return {
      draft: {
        type: variant,
        accountId: fixture.account.id,
        amountMinor: "3100",
        currency: "BRL",
        occurredOn: "2026-08-11",
        description: "Opening correction",
      },
      postings: [
        { accountId: fixture.account.id, amountMinor: 3100n },
        { accountId: "account-1", amountMinor: -3100n },
      ],
    }
  }
  if (variant === "INCOME") {
    return {
      draft: {
        type: variant,
        accountId: fixture.account.id,
        categoryId: fixture.incomeCategory.id,
        amountMinor: "4500",
        currency: "BRL",
        occurredOn: "2026-08-12",
        description: "Refund",
      },
      postings: [
        { accountId: fixture.account.id, amountMinor: 4500n },
        { accountId: fixture.incomeCategory.id, amountMinor: -4500n },
      ],
    }
  }
  if (variant === "EXPENSE") {
    return {
      draft: {
        type: variant,
        accountId: fixture.destination.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-10",
        description: "Dinner",
      },
      postings: [
        { accountId: fixture.category.id, amountMinor: 3000n },
        { accountId: fixture.destination.id, amountMinor: -3000n },
      ],
    }
  }
  return {
    draft: {
      type: variant,
      sourceAccountId: fixture.account.id,
      destinationAccountId: fixture.destination.id,
      amountMinor: "5000",
      currency: "BRL",
      occurredOn: "2026-08-13",
      description: "Move money",
    },
    postings: [
      { accountId: fixture.account.id, amountMinor: -5000n },
      { accountId: fixture.destination.id, amountMinor: 5000n },
    ],
  }
}

function defineContracts(name: string, factory: AdapterFactory): void {
  describe(name, () => {
    it("preserves income, expense, transfer and opening outcomes", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const account = await createAccount(adapter)
        const destination = await createAccount(adapter, "Savings")
        const expenseCategory = await createCategory(adapter, "EXPENSE")
        const incomeCategory = await createCategory(adapter, "INCOME")
        const common = {
          bookId: "book-1",
          currency: "BRL",
          occurredOn: "2026-08-04",
        }

        const opening = await new SetOpeningBalance(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          ...common,
          accountId: account.id,
          amountMinor: "10000",
          description: "Opening",
        })
        const income = await new RecordIncome(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          ...common,
          accountId: account.id,
          categoryId: incomeCategory.id,
          amountMinor: "2500",
          description: "Salary",
        })
        const expense = await new RecordExpense(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          ...common,
          accountId: account.id,
          categoryId: expenseCategory.id,
          amountMinor: "700",
          description: "Lunch",
        })
        const transfer = await new TransferMoney(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          ...common,
          sourceAccountId: account.id,
          destinationAccountId: destination.id,
          amountMinor: "300",
          description: "Move savings",
        })

        expect(
          [opening, income, expense, transfer].every((result) => result.ok)
        ).toBe(true)
        expect(await snapshot(adapter, "entry-1")).toMatchObject({
          sequence: "1",
          postings: [
            { accountId: account.id, amountMinor: 10000n },
            { accountId: "account-1", amountMinor: -10000n },
          ],
        })
        expect(await snapshot(adapter, "entry-2")).toMatchObject({
          sequence: "2",
          postings: [
            { accountId: account.id, amountMinor: 2500n },
            { accountId: incomeCategory.id, amountMinor: -2500n },
          ],
        })
        expect(await snapshot(adapter, "entry-3")).toMatchObject({
          sequence: "3",
          postings: [
            { accountId: expenseCategory.id, amountMinor: 700n },
            { accountId: account.id, amountMinor: -700n },
          ],
        })
        expect(await snapshot(adapter, "entry-4")).toMatchObject({
          sequence: "4",
          postings: [
            { accountId: account.id, amountMinor: -300n },
            { accountId: destination.id, amountMinor: 300n },
          ],
        })
        expect(adapter.publisher.events.map(({ type }) => type)).toEqual([
          "JournalEntryPosted",
          "JournalEntryPosted",
          "JournalEntryPosted",
          "JournalEntryPosted",
        ])
      }))

    it("round-trips the signed int64 maximum as exact money and event strings", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const account = await createAccount(adapter)
        const category = await createCategory(adapter, "INCOME")
        const amountMinor = "9223372036854775807"
        const result = await new RecordIncome(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          accountId: account.id,
          categoryId: category.id,
          amountMinor,
          currency: "BRL",
          occurredOn: "2026-08-04",
          description: "Maximum income",
        })

        expect(result).toMatchObject({ ok: true, value: { id: "entry-1" } })
        expect(await snapshot(adapter, "entry-1")).toMatchObject({
          postings: [
            { accountId: account.id, amountMinor: 9223372036854775807n },
            { accountId: category.id, amountMinor: -9223372036854775807n },
          ],
        })
        expect(adapter.publisher.events[0]).toMatchObject({
          payload: {
            postings: [
              { accountId: account.id, amountMinor },
              { accountId: category.id, amountMinor: "-9223372036854775807" },
            ],
          },
        })
      }))

    it.each(["OPENING_BALANCE", "INCOME", "EXPENSE", "TRANSFER"] as const)(
      "creates an exact %s replacement",
      async (variant) =>
        withAdapter(factory, async (adapter) => {
          const fixture = await preparedExpense(adapter)
          const expected = replacementFor(variant, fixture)
          const result = await amend(adapter).execute(
            amendCommand(fixture.originalId, expected.draft)
          )

          expect(result).toEqual({
            ok: true,
            value: {
              targetId: "entry-1",
              reversalId: "entry-2",
              replacementId: "entry-3",
              replacementVersion: 0,
              state: "EFFECTIVE",
            },
          })
          expect(await snapshot(adapter, "entry-1")).toMatchObject({
            reversedBy: "entry-2",
            replacedBy: "entry-3",
            version: 1,
          })
          expect(await snapshot(adapter, "entry-2")).toMatchObject({
            reversalOf: "entry-1",
            occurredOn: "2026-08-04",
            recordedAt: RECORDED_AT,
            sequence: "2",
            version: 0,
          })
          expect(await snapshot(adapter, "entry-3")).toMatchObject({
            replacementOf: "entry-1",
            occurredOn: expected.draft.occurredOn,
            recordedAt: RECORDED_AT,
            sequence: "3",
            postings: expected.postings,
          })
          expect(adapter.publisher.events.map(({ type }) => type)).toEqual([
            "JournalEntryPosted",
            "JournalEntryPosted",
            "JournalEntryAmended",
          ])
          expect(adapter.publisher.events[2]).toMatchObject({
            payload: {
              bookId: "book-1",
              originalId: "entry-1",
              reversalId: "entry-2",
              replacementId: "entry-3",
            },
          })
        })
    )

    it("amends the effective replacement repeatedly and cancels the final chain", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedExpense(adapter)
        const first = await amend(adapter).execute(
          amendCommand(fixture.originalId, {
            type: "EXPENSE",
            accountId: fixture.account.id,
            categoryId: fixture.category.id,
            amountMinor: "3000",
            currency: "BRL",
            occurredOn: "2026-08-05",
            description: "First correction",
          })
        )
        if (!first.ok) throw new Error(first.error.code)
        adapter.publisher.clear()
        const second = await amend(adapter).execute(
          amendCommand(first.value.replacementId, {
            type: "EXPENSE",
            accountId: fixture.destination.id,
            categoryId: fixture.category.id,
            amountMinor: "3500",
            currency: "BRL",
            occurredOn: "2026-08-06",
            description: "Second correction",
          })
        )
        if (!second.ok) throw new Error(second.error.code)
        adapter.publisher.clear()
        const cancelled = await reverse(adapter).execute({
          bookId: "book-1",
          journalEntryId: second.value.replacementId,
          expectedVersion: 0,
          occurredOn: "2026-08-07",
          description: "Cancel final correction",
        })

        expect(cancelled).toMatchObject({ ok: true, value: { id: "entry-6" } })
        expect(await snapshot(adapter, "entry-1")).toMatchObject({
          reversedBy: "entry-2",
          replacedBy: "entry-3",
          version: 1,
        })
        expect(await snapshot(adapter, "entry-3")).toMatchObject({
          replacementOf: "entry-1",
          reversedBy: "entry-4",
          replacedBy: "entry-5",
          version: 1,
        })
        expect(await snapshot(adapter, "entry-5")).toMatchObject({
          replacementOf: "entry-3",
          reversedBy: "entry-6",
          version: 1,
        })
        expect(await snapshot(adapter, "entry-6")).toMatchObject({
          reversalOf: "entry-5",
          sequence: "6",
        })
        expect(
          (
            await Promise.all(
              [
                "entry-1",
                "entry-2",
                "entry-3",
                "entry-4",
                "entry-5",
                "entry-6",
              ].map((id) => snapshot(adapter, id))
            )
          ).filter(
            (entry) =>
              entry.replacedBy === undefined && entry.reversalOf === undefined
          )
        ).toHaveLength(1)
        expect(adapter.publisher.events.map(({ type }) => type)).toEqual([
          "JournalEntryPosted",
          "JournalEntryReversed",
        ])
      }))

    it("rolls back amendment rows, links, version, sequence and facts on conflict", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedExpense(adapter)
        const before = await snapshot(adapter, fixture.originalId)
        const result = await amend(
          adapter,
          journalConflictManager(adapter.transactionManager)
        ).execute(
          amendCommand(fixture.originalId, {
            type: "EXPENSE",
            accountId: fixture.account.id,
            categoryId: fixture.category.id,
            amountMinor: "3000",
            currency: "BRL",
            occurredOn: "2026-08-06",
            description: "Rejected correction",
          })
        )

        expect(result).toMatchObject({
          ok: false,
          error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
        })
        expect(await snapshot(adapter, fixture.originalId)).toEqual(before)
        await expect(
          adapter.journalEntries.findById("entry-2" as never)
        ).resolves.toBeNull()
        await expect(
          adapter.journalEntries.findById("entry-3" as never)
        ).resolves.toBeNull()
        expect(adapter.publisher.events).toEqual([])
        const next = await new RecordExpense(
          adapter.transactionManager,
          adapter.dispatcher,
          adapter.ids,
          adapter.clock
        ).execute({
          bookId: "book-1",
          accountId: fixture.account.id,
          categoryId: fixture.category.id,
          amountMinor: "100",
          currency: "BRL",
          occurredOn: "2026-08-06",
          description: "After rollback",
        })
        if (!next.ok) throw new Error(next.error.code)
        expect(await snapshot(adapter, next.value.id)).toMatchObject({
          sequence: "2",
          version: 0,
        })
      }))

    it.each([
      "same transfer account",
      "negative amount",
      "archived replacement account",
      "cross-book replacement account",
    ] as const)(
      "rejects %s amendment without partial state",
      async (caseName) =>
        withAdapter(factory, async (adapter) => {
          const fixture = await preparedExpense(adapter)
          let replacement: JournalBusinessDraft = {
            type: "EXPENSE",
            accountId: fixture.account.id,
            categoryId: fixture.category.id,
            amountMinor: "3000",
            currency: "BRL",
            occurredOn: "2026-08-06",
            description: "Rejected",
          }
          if (caseName === "same transfer account")
            replacement = {
              type: "TRANSFER",
              sourceAccountId: fixture.account.id,
              destinationAccountId: fixture.account.id,
              amountMinor: "3000",
              currency: "BRL",
              occurredOn: "2026-08-06",
              description: "Rejected",
            }
          if (caseName === "negative amount")
            replacement = { ...replacement, amountMinor: "-1" }
          if (caseName === "archived replacement account") {
            const archived = await new ArchiveLedgerAccount(
              adapter.transactionManager,
              adapter.dispatcher
            ).execute({
              bookId: "book-1",
              accountId: fixture.destination.id,
              expectedVersion: 0,
            })
            expect(archived.ok).toBe(true)
            adapter.publisher.clear()
            replacement = { ...replacement, accountId: fixture.destination.id }
          }
          if (caseName === "cross-book replacement account") {
            const secondBook = await new CreateFinancialBook(
              adapter.transactionManager,
              adapter.dispatcher,
              adapter.ids
            ).execute({ name: "Other", baseCurrency: "BRL", timezone: "UTC" })
            expect(secondBook.ok).toBe(true)
            const foreign = await new CreateFinancialAccount(
              adapter.transactionManager,
              adapter.dispatcher,
              adapter.ids
            ).execute({ bookId: "book-2", name: "Foreign", kind: "ASSET" })
            expect(foreign.ok).toBe(true)
            adapter.publisher.clear()
            replacement = { ...replacement, accountId: "account-10" }
          }
          const before = await snapshot(adapter, fixture.originalId)
          const expectedCode =
            caseName === "same transfer account"
              ? "SAME_TRANSFER_ACCOUNT"
              : caseName === "negative amount"
                ? "NON_POSITIVE_AMOUNT"
                : caseName === "archived replacement account"
                  ? "INVALID_ACCOUNT_STATUS"
                  : "BOOK_MISMATCH"
          const result = await amend(adapter).execute(
            amendCommand(fixture.originalId, replacement)
          )

          expect(result).toMatchObject({
            ok: false,
            error: { code: expectedCode },
          })
          expect(await snapshot(adapter, fixture.originalId)).toEqual(before)
          await expect(
            adapter.journalEntries.findById("entry-2" as never)
          ).resolves.toBeNull()
          expect(adapter.publisher.events).toEqual([])
        })
    )

    it("renames, archives and reactivates an account without changing its journal history", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedExpense(adapter)
        const beforeEntry = await snapshot(adapter, fixture.originalId)
        const renamed = await new RenameLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: fixture.account.id,
          expectedVersion: 0,
          name: "Main cash",
        })
        expect(renamed).toMatchObject({
          ok: true,
          value: {
            id: fixture.account.id,
            name: "Main cash",
            kind: "ASSET",
            status: "ACTIVE",
            version: 1,
          },
        })
        expect(adapter.publisher.events[0]).toMatchObject({
          type: "LedgerAccountRenamed",
          aggregateId: fixture.account.id,
          aggregateVersion: 1,
          payload: { name: "Main cash", kind: "ASSET", status: "ACTIVE" },
        })
        adapter.publisher.clear()
        const archived = await new ArchiveLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: fixture.account.id,
          expectedVersion: 1,
        })
        expect(archived).toMatchObject({
          ok: true,
          value: {
            id: fixture.account.id,
            name: "Main cash",
            kind: "ASSET",
            status: "ARCHIVED",
            version: 2,
          },
        })
        adapter.publisher.clear()
        const reactivated = await new ReactivateLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: fixture.account.id,
          expectedVersion: 2,
        })
        expect(reactivated).toMatchObject({
          ok: true,
          value: {
            id: fixture.account.id,
            name: "Main cash",
            kind: "ASSET",
            status: "ACTIVE",
            version: 3,
          },
        })
        expect(
          await adapter.accounts.findById(fixture.account.id as never)
        ).toMatchObject({
          id: fixture.account.id,
          kind: "ASSET",
          status: "ACTIVE",
          version: 3,
        })
        expect(await snapshot(adapter, fixture.originalId)).toEqual(beforeEntry)
      }))

    it("preserves category kind and postings through archive and reactivation", async () =>
      withAdapter(factory, async (adapter) => {
        const fixture = await preparedExpense(adapter)
        const beforeEntry = await snapshot(adapter, fixture.originalId)
        const archived = await new ArchiveLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: fixture.category.id,
          expectedVersion: 0,
        })
        expect(archived).toMatchObject({
          ok: true,
          value: {
            id: fixture.category.id,
            kind: "EXPENSE",
            status: "ARCHIVED",
            version: 1,
          },
        })
        adapter.publisher.clear()
        const reactivated = await new ReactivateLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: fixture.category.id,
          expectedVersion: 1,
        })
        expect(reactivated).toMatchObject({
          ok: true,
          value: {
            id: fixture.category.id,
            kind: "EXPENSE",
            status: "ACTIVE",
            version: 2,
          },
        })
        expect(await snapshot(adapter, fixture.originalId)).toEqual(beforeEntry)
      }))

    it("keeps repeated lifecycle commands idempotent and protects system accounts", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const account = await createAccount(adapter)
        const firstArchive = await new ArchiveLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: account.id,
          expectedVersion: 0,
        })
        expect(firstArchive).toMatchObject({
          ok: true,
          value: { status: "ARCHIVED", version: 1 },
        })
        adapter.publisher.clear()
        const secondArchive = await new ArchiveLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: account.id,
          expectedVersion: 1,
        })
        expect(secondArchive).toMatchObject({
          ok: true,
          value: { status: "ARCHIVED", version: 1 },
        })
        expect(adapter.publisher.events).toEqual([])
        const firstReactivate = await new ReactivateLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: account.id,
          expectedVersion: 1,
        })
        expect(firstReactivate).toMatchObject({
          ok: true,
          value: { status: "ACTIVE", version: 2 },
        })
        adapter.publisher.clear()
        const secondReactivate = await new ReactivateLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: account.id,
          expectedVersion: 2,
        })
        expect(secondReactivate).toMatchObject({
          ok: true,
          value: { status: "ACTIVE", version: 2 },
        })
        expect(adapter.publisher.events).toEqual([])
        const systemArchive = await new ArchiveLedgerAccount(
          adapter.transactionManager,
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: "account-1",
          expectedVersion: 0,
        })
        expect(systemArchive).toMatchObject({
          ok: false,
          error: { code: "SYSTEM_ACCOUNT_PROTECTED" },
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it("rolls back lifecycle rename state, version and facts on save conflict", async () =>
      withAdapter(factory, async (adapter) => {
        await createBook(adapter)
        const account = await createAccount(adapter)
        const before = await adapter.accounts.findById(account.id as never)
        const result = await new RenameLedgerAccount(
          accountConflictManager(adapter.transactionManager),
          adapter.dispatcher
        ).execute({
          bookId: "book-1",
          accountId: account.id,
          expectedVersion: 0,
          name: "Main cash",
        })

        expect(result).toMatchObject({
          ok: false,
          error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
        })
        expect(
          await adapter.accounts.findById(account.id as never)
        ).toMatchObject({
          name: before?.name,
          normalizedName: before?.normalizedName,
          kind: "ASSET",
          status: "ACTIVE",
          version: 0,
        })
        expect(adapter.publisher.events).toEqual([])
      }))

    it.each([
      "duplicate normalized name",
      "stale version",
      "missing book",
    ] as const)(
      "rejects %s lifecycle mutation without writing",
      async (caseName) =>
        withAdapter(factory, async (adapter) => {
          await createBook(adapter)
          const account = await createAccount(adapter)
          await createAccount(adapter, "Savings")
          const before = await adapter.accounts.findById(account.id as never)
          const command =
            caseName === "duplicate normalized name"
              ? {
                  bookId: "book-1",
                  accountId: account.id,
                  expectedVersion: 0,
                  name: " savings ",
                }
              : caseName === "stale version"
                ? {
                    bookId: "book-1",
                    accountId: account.id,
                    expectedVersion: 1,
                    name: "Main cash",
                  }
                : {
                    bookId: "book-2",
                    accountId: account.id,
                    expectedVersion: 0,
                    name: "Main cash",
                  }
          const expectedCode =
            caseName === "duplicate normalized name"
              ? "DUPLICATE_ENTITY"
              : caseName === "stale version"
                ? "OPTIMISTIC_CONCURRENCY_FAILURE"
                : "ENTITY_NOT_FOUND"
          const result = await new RenameLedgerAccount(
            adapter.transactionManager,
            adapter.dispatcher
          ).execute(command)

          expect(result).toMatchObject({
            ok: false,
            error: { code: expectedCode },
          })
          expect(
            await adapter.accounts.findById(account.id as never)
          ).toMatchObject({
            name: before?.name,
            normalizedName: before?.normalizedName,
            version: 0,
          })
          expect(adapter.publisher.events).toEqual([])
        })
    )
  })
}

defineContracts("ledger completion contracts: memory", memoryFactory)
defineContracts("ledger completion contracts: sqlite", sqliteFactory)
