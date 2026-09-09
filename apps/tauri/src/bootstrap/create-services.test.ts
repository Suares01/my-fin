import { describe, expect, it, vi } from "vitest"
import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  GetCategoryDetail,
  GetFinancialBook,
  GetJournalChainDetail,
  GetJournalChainSummary,
  GetCategorySpending,
  GetMonthlyCashFlow,
  GetNetWorth,
  ArchiveLedgerAccount,
  ListAccountBalances,
  ListAccountStatement,
  ListCategories,
  ListExpenseCategories,
  ListFinancialBooks,
  ListIncomeCategories,
  ListJournalChains,
  ListJournalEntries,
  RecordIncome,
  RecordExpense,
  RenameLedgerAccount,
  ReactivateLedgerAccount,
  ReverseJournalEntry,
  AmendJournalEntry,
  SetOpeningBalance,
  TransferMoney,
} from "@workspace/application"
import type { SqliteDatabase } from "@workspace/infrastructure-sqlite"
import {
  TauriClock,
  TauriEventPublisher,
  TauriIdGenerator,
} from "@workspace/infrastructure-tauri"
import { createMyFinServices } from "./create-services.js"

function createServices(
  overrides: {
    readonly database?: SqliteDatabase
    readonly publisher?: TauriEventPublisher
  } = {}
) {
  const database =
    overrides.database ??
    ({
      execute: vi.fn(),
      query: vi.fn(),
      executeBatch: vi.fn(),
      transaction: vi.fn(),
      readTransaction: vi.fn(),
      close: vi.fn(),
    } as unknown as SqliteDatabase)
  return createMyFinServices({
    database,
    clock: new TauriClock({ now: () => new Date("2026-08-05T00:00:00.000Z") }),
    ids: new TauriIdGenerator({
      randomUUID: () => "00000000-0000-4000-8000-000000000000",
    }),
    publisher: overrides.publisher ?? new TauriEventPublisher(),
  })
}

describe("createMyFinServices", () => {
  it("returns exactly the public facade groups from the design", () => {
    const services = createServices()

    expect(Object.keys(services)).toEqual([
      "books",
      "accounts",
      "categories",
      "income",
      "expenses",
      "transfers",
      "journal",
      "insights",
    ])
    expect(Object.keys(services.books)).toEqual(["list", "get", "create"])
    expect(Object.keys(services.accounts)).toEqual([
      "listBalances",
      "create",
      "setOpeningBalance",
      "listStatement",
      "rename",
      "archive",
      "reactivate",
    ])
    expect(Object.keys(services.categories)).toEqual([
      "list",
      "listIncome",
      "listExpenses",
      "get",
      "createIncome",
      "createExpense",
      "rename",
      "archive",
      "reactivate",
    ])
    expect(Object.keys(services.income)).toEqual(["record"])
    expect(Object.keys(services.expenses)).toEqual(["record"])
    expect(Object.keys(services.transfers)).toEqual(["record"])
    expect(Object.keys(services.journal)).toEqual([
      "list",
      "listChains",
      "summary",
      "getChain",
      "reverse",
      "amend",
    ])
    expect(Object.keys(services.insights)).toEqual([
      "netWorth",
      "monthlyCashFlow",
      "categorySpending",
    ])
  })

  it("wires book list and create handlers", () => {
    const services = createServices()

    expect(services.books.list).toBeInstanceOf(ListFinancialBooks)
    expect(services.books.get).toBeInstanceOf(GetFinancialBook)
    expect(services.books.create).toBeInstanceOf(CreateFinancialBook)
  })

  it("wires all account handlers", () => {
    const services = createServices()

    expect(services.accounts.listBalances).toBeInstanceOf(ListAccountBalances)
    expect(services.accounts.create).toBeInstanceOf(CreateFinancialAccount)
    expect(services.accounts.setOpeningBalance).toBeInstanceOf(
      SetOpeningBalance
    )
    expect(services.accounts.listStatement).toBeInstanceOf(ListAccountStatement)
    expect(services.accounts.rename).toBeInstanceOf(RenameLedgerAccount)
    expect(services.accounts.archive).toBeInstanceOf(ArchiveLedgerAccount)
    expect(services.accounts.reactivate).toBeInstanceOf(ReactivateLedgerAccount)
  })

  it("wires all category handlers", () => {
    const services = createServices()

    expect(services.categories.list).toBeInstanceOf(ListCategories)
    expect(services.categories.listIncome).toBeInstanceOf(ListIncomeCategories)
    expect(services.categories.listExpenses).toBeInstanceOf(
      ListExpenseCategories
    )
    expect(services.categories.get).toBeInstanceOf(GetCategoryDetail)
    expect(services.categories.createIncome).toBeInstanceOf(
      CreateIncomeCategory
    )
    expect(services.categories.createExpense).toBeInstanceOf(
      CreateExpenseCategory
    )
    expect(services.categories.rename).toBeInstanceOf(RenameLedgerAccount)
    expect(services.categories.archive).toBeInstanceOf(ArchiveLedgerAccount)
    expect(services.categories.reactivate).toBeInstanceOf(
      ReactivateLedgerAccount
    )
  })

  it("wires income, transfer, journal maintenance and insight handlers", () => {
    const services = createServices()

    expect(services.income.record).toBeInstanceOf(RecordIncome)
    expect(services.transfers.record).toBeInstanceOf(TransferMoney)
    expect(services.journal.listChains).toBeInstanceOf(ListJournalChains)
    expect(services.journal.summary).toBeInstanceOf(GetJournalChainSummary)
    expect(services.journal.getChain).toBeInstanceOf(GetJournalChainDetail)
    expect(services.journal.reverse).toBeInstanceOf(ReverseJournalEntry)
    expect(services.journal.amend).toBeInstanceOf(AmendJournalEntry)
    expect(services.insights.netWorth).toBeInstanceOf(GetNetWorth)
    expect(services.insights.monthlyCashFlow).toBeInstanceOf(GetMonthlyCashFlow)
    expect(services.insights.categorySpending).toBeInstanceOf(
      GetCategorySpending
    )
  })

  it("wires the expense command", () => {
    const services = createServices()

    expect(services.expenses.record).toBeInstanceOf(RecordExpense)
  })

  it("wires the global journal query", () => {
    const services = createServices()

    expect(services.journal.list).toBeInstanceOf(ListJournalEntries)
  })

  it("creates independent facades without a hidden global singleton", () => {
    const first = createServices()
    const second = createServices()

    expect(first).not.toBe(second)
    expect(first.books.create).not.toBe(second.books.create)
  })

  it("does not expose infrastructure fields in the public facade shape", () => {
    const services = createServices()

    expect(Object.keys(services)).not.toContain("database")
    expect(Object.keys(services)).not.toContain("transactionManager")
    expect(Object.keys(services)).not.toContain("invoke")
  })

  it("publishes a created-book event through the shared post-commit path", async () => {
    const executor = {
      execute: vi
        .fn()
        .mockResolvedValue({ rowsAffected: 1, lastInsertRowId: "0" }),
      query: vi.fn().mockResolvedValue([]),
      executeBatch: vi.fn().mockResolvedValue(undefined),
    }
    const database = {
      execute: vi.fn(),
      query: vi.fn(),
      executeBatch: vi.fn(),
      transaction: vi.fn(
        async (work: (value: typeof executor) => Promise<unknown>) =>
          work(executor)
      ),
      readTransaction: vi.fn(),
      close: vi.fn(),
    } as unknown as SqliteDatabase
    const publisher = new TauriEventPublisher()
    const published: string[] = []
    publisher.subscribe((event) => {
      published.push(event.type)
    })
    const services = createServices({ database, publisher })

    const result = await services.books.create.execute({
      name: "Casa",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })

    expect(result.ok).toBe(true)
    expect(published).toEqual([
      "FinancialBookCreated",
      "LedgerAccountCreated",
      "LedgerAccountCreated",
      "LedgerAccountCreated",
      "LedgerAccountCreated",
    ])
    expect(database.transaction).toHaveBeenCalledOnce()
  })
})
