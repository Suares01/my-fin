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
  TransferMoney,
  type AccountDto,
  type BookDto,
  type IdGenerator,
  type JournalEntryCommand,
  type TransactionManager,
} from "@workspace/application"
import {
  bookIdFromString,
  Currency,
  JournalEntry,
  journalEntryIdFromString,
  LocalDate,
  Money,
  Posting,
  type JournalEntrySnapshot,
} from "@workspace/domain"
import {
  CollectingDomainEventPublisher,
  FixedClock,
  SequentialIdGenerator,
} from "@workspace/infrastructure-memory"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { SqliteTransactionManager } from "../../src/transaction/sqlite-transaction-manager.js"
import { BetterSqliteDatabase } from "./better-sqlite-database.js"

const FIXED_INSTANT = "2026-08-04T12:00:00.000Z"
const FIXED_DATE = "2026-08-04"
const BOOK_COMMAND = {
  name: "Personal book",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
} as const

type SplitPosting = {
  readonly accountId: string
  readonly amountMinor: string
}

export type FinancialQueryScenario = {
  readonly database: BetterSqliteDatabase
  readonly transactionManager: TransactionManager
  readonly ids: IdGenerator
  readonly clock: FixedClock
  readonly publisher: CollectingDomainEventPublisher
  readonly books: SqliteFinancialBookRepository
  readonly accounts: SqliteLedgerAccountRepository
  readonly journalEntries: SqliteJournalEntryRepository
  createBook(): Promise<BookDto>
  createFinancialAccount(input?: {
    readonly name?: string
    readonly kind?: "ASSET" | "LIABILITY"
  }): Promise<AccountDto>
  createExpenseCategory(name?: string): Promise<AccountDto>
  createIncomeCategory(name?: string): Promise<AccountDto>
  setOpeningBalance(input: {
    readonly accountId: string
    readonly amountMinor: string
    readonly occurredOn?: string
    readonly description?: string
  }): Promise<string>
  recordExpense(input: {
    readonly accountId: string
    readonly categoryId: string
    readonly amountMinor: string
    readonly occurredOn?: string
    readonly description?: string
  }): Promise<string>
  recordIncome(input: {
    readonly accountId: string
    readonly categoryId: string
    readonly amountMinor: string
    readonly occurredOn?: string
    readonly description?: string
  }): Promise<string>
  transfer(input: {
    readonly sourceAccountId: string
    readonly destinationAccountId: string
    readonly amountMinor: string
    readonly occurredOn?: string
    readonly description?: string
  }): Promise<string>
  addSplit(input: {
    readonly accountId: string
    readonly categories: readonly SplitPosting[]
    readonly occurredOn?: string
    readonly description?: string
  }): Promise<string>
  reverse(input: {
    readonly journalEntryId: string
    readonly occurredOn?: string
    readonly description?: string
  }): Promise<string>
  archiveAccount(accountId: string): Promise<void>
  snapshot(journalEntryId: string): Promise<JournalEntrySnapshot>
  close(): Promise<void>
}

export async function createFinancialQueryScenario(
  database = new BetterSqliteDatabase()
): Promise<FinancialQueryScenario> {
  await initializeSqliteDatabase(database, { inMemory: true })

  const ids = new SequentialIdGenerator()
  const clock = new FixedClock(FIXED_INSTANT, FIXED_DATE)
  const publisher = new CollectingDomainEventPublisher()
  const transactionManager = new SqliteTransactionManager(database)
  const dispatcher = new DomainEventDispatcher(clock, ids, publisher)
  const books = new SqliteFinancialBookRepository(database)
  const accounts = new SqliteLedgerAccountRepository(database)
  const journalEntries = new SqliteJournalEntryRepository(database)

  const scenario: FinancialQueryScenario = {
    database,
    transactionManager,
    ids,
    clock,
    publisher,
    books,
    accounts,
    journalEntries,
    async createBook() {
      const result = await new CreateFinancialBook(
        transactionManager,
        dispatcher,
        ids
      ).execute(BOOK_COMMAND)
      const book = unwrap(result, "book fixture")
      clearPublishedEvents(publisher)
      return book
    },
    async createFinancialAccount(input = {}) {
      const kind = input.kind ?? "ASSET"
      const result = await new CreateFinancialAccount(
        transactionManager,
        dispatcher,
        ids
      ).execute({
        bookId: "book-1",
        name: input.name ?? (kind === "ASSET" ? "Checking" : "Credit card"),
        kind,
      })
      const account = unwrap(result, "financial account fixture")
      clearPublishedEvents(publisher)
      return account
    },
    async createExpenseCategory(name = "Food") {
      const result = await new CreateExpenseCategory(
        transactionManager,
        dispatcher,
        ids
      ).execute({ bookId: "book-1", name, kind: "EXPENSE" })
      const category = unwrap(result, "expense category fixture")
      clearPublishedEvents(publisher)
      return category
    },
    async createIncomeCategory(name = "Salary") {
      const result = await new CreateIncomeCategory(
        transactionManager,
        dispatcher,
        ids
      ).execute({ bookId: "book-1", name, kind: "INCOME" })
      const category = unwrap(result, "income category fixture")
      clearPublishedEvents(publisher)
      return category
    },
    async setOpeningBalance(input) {
      const result = await new SetOpeningBalance(
        transactionManager,
        dispatcher,
        ids,
        clock
      ).execute({
        bookId: "book-1",
        accountId: input.accountId,
        amountMinor: input.amountMinor,
        currency: "BRL",
        occurredOn: input.occurredOn ?? FIXED_DATE,
        description: input.description ?? "Opening balance",
      })
      const entry = unwrap(result, "opening balance fixture")
      clearPublishedEvents(publisher)
      return entry.id
    },
    async recordExpense(input) {
      const result = await new RecordExpense(
        transactionManager,
        dispatcher,
        ids,
        clock
      ).execute(toJournalCommand(input))
      const entry = unwrap(result, "expense fixture")
      clearPublishedEvents(publisher)
      return entry.id
    },
    async recordIncome(input) {
      const result = await new RecordIncome(
        transactionManager,
        dispatcher,
        ids,
        clock
      ).execute(toJournalCommand(input))
      const entry = unwrap(result, "income fixture")
      clearPublishedEvents(publisher)
      return entry.id
    },
    async transfer(input) {
      const result = await new TransferMoney(
        transactionManager,
        dispatcher,
        ids,
        clock
      ).execute({
        bookId: "book-1",
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        amountMinor: input.amountMinor,
        currency: "BRL",
        occurredOn: input.occurredOn ?? FIXED_DATE,
        description: input.description ?? "Transfer",
      })
      const entry = unwrap(result, "transfer fixture")
      clearPublishedEvents(publisher)
      return entry.id
    },
    async addSplit(input) {
      const result = await transactionManager.execute(async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString("book-1")
        )
        if (book === null) {
          throw new Error("Split fixture requires book-1")
        }

        const categories = await Promise.all(
          input.categories.map(async ({ accountId }) => {
            const account = await repositories.accounts.findById(
              accountId as never
            )
            if (account === null) {
              throw new Error(
                `Split fixture account ${accountId} was not found`
              )
            }
            return account
          })
        )
        const total = input.categories.reduce(
          (sum, posting) => sum + BigInt(posting.amountMinor),
          0n
        )
        if (categories.length === 0 || total <= 0n) {
          throw new Error("Split fixture requires positive category postings")
        }

        const currency = Currency.parse("BRL")
        const postings = input.categories.map((posting) =>
          Posting.create({
            id: ids.nextPostingId(),
            accountId: posting.accountId as never,
            amount: Money.of(BigInt(posting.amountMinor), currency),
          })
        )
        postings.push(
          Posting.create({
            id: ids.nextPostingId(),
            accountId: input.accountId as never,
            amount: Money.of(-total, currency),
          })
        )

        const entry = JournalEntry.post({
          id: journalEntryIdFromString(ids.nextJournalEntryId()),
          bookId: book.id,
          occurredOn: LocalDate.parse(input.occurredOn ?? FIXED_DATE),
          recordedAt: clock.now(),
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          description: input.description ?? "Split expense",
          currency,
          origin: "MANUAL",
          postings,
        })
        await repositories.journalEntries.add(entry)
        return entry.id
      })
      await dispatcher.dispatch(result.facts)
      clearPublishedEvents(publisher)
      return result.value as string
    },
    async reverse(input) {
      const target = await journalEntries.findById(
        journalEntryIdFromString(input.journalEntryId)
      )
      if (target === null) {
        throw new Error(`Journal fixture ${input.journalEntryId} was not found`)
      }
      const result = await new ReverseJournalEntry(
        transactionManager,
        dispatcher,
        ids,
        clock
      ).execute({
        bookId: "book-1",
        journalEntryId: input.journalEntryId,
        expectedVersion: target.version,
        occurredOn: input.occurredOn ?? FIXED_DATE,
        description: input.description ?? "Reversal",
      })
      const entry = unwrap(result, "reversal fixture")
      clearPublishedEvents(publisher)
      return entry.id
    },
    async archiveAccount(accountId) {
      const result = await transactionManager.execute(async (repositories) => {
        const account = await repositories.accounts.findById(accountId as never)
        if (account === null) {
          throw new Error(`Archive fixture account ${accountId} was not found`)
        }
        const expectedVersion = account.version
        account.archive()
        await repositories.accounts.save(account, expectedVersion)
      })
      await dispatcher.dispatch(result.facts)
      clearPublishedEvents(publisher)
    },
    async snapshot(journalEntryId) {
      const entry = await journalEntries.findById(journalEntryId as never)
      if (entry === null) {
        throw new Error(`Journal fixture ${journalEntryId} was not found`)
      }
      return entry.toSnapshot()
    },
    async close() {
      await database.close()
    },
  }

  return scenario
}

function toJournalCommand(input: {
  readonly accountId: string
  readonly categoryId: string
  readonly amountMinor: string
  readonly occurredOn?: string
  readonly description?: string
}): JournalEntryCommand {
  return {
    bookId: "book-1",
    accountId: input.accountId,
    categoryId: input.categoryId,
    amountMinor: input.amountMinor,
    currency: "BRL",
    occurredOn: input.occurredOn ?? FIXED_DATE,
    description: input.description ?? "Cash flow",
  }
}

function unwrap<T>(
  result: {
    readonly ok: boolean
    readonly value?: T
    readonly error?: unknown
  },
  label: string
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`${label} failed: ${String(result.error)}`)
  }
  return result.value
}

function clearPublishedEvents(publisher: CollectingDomainEventPublisher): void {
  publisher.clear()
}
