import { describe, expect, it, vi } from "vitest"
import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  ConfigureFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  ArchiveCategory,
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
  UpdateCategory,
  ReactivateCategory,
  ReactivateLedgerAccount,
  ReverseJournalEntry,
  AmendJournalEntry,
  AmendInvestmentOperation,
  CreateInvestmentInstrument,
  GetInvestmentPortfolioSummary,
  ListInvestmentAccounts,
  ListInvestmentInstruments,
  ListInvestmentOperations,
  ListInvestmentPositions,
  ListInvestmentValuations,
  OpenInvestmentPosition,
  OpenInvestmentPositionWithPurchase,
  PreviewInvestmentOperation,
  RecordInvestmentAmortization,
  RecordInvestmentExpense,
  RecordInvestmentIncome,
  RecordInvestmentPurchase,
  RecordInvestmentSale,
  RecordInvestmentValuation,
  ReverseInvestmentOperation,
  SetInvestmentInstrumentStatus,
  SetInvestmentOpeningBalance,
  SetOpeningBalance,
  TransferMoney,
  UpdateInvestmentInstrument,
  UpdateInvestmentPositionMetadata,
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
  it("exposes the investments facade with all public subgroups", () => {
    const services = createServices()

    expect(Object.keys(services.investments)).toEqual([
      "accounts",
      "instruments",
      "positions",
      "operations",
      "valuations",
      "portfolio",
      "requests",
    ])
  })

  it("wires the investment account command and query", () => {
    const services = createServices()

    expect(services.investments.accounts.list).toBeInstanceOf(
      ListInvestmentAccounts
    )
    expect(services.investments.accounts.setOpeningBalance).toBeInstanceOf(
      SetInvestmentOpeningBalance
    )
  })

  it("wires instrument commands and queries to dedicated use cases", () => {
    const services = createServices()

    expect(services.investments.instruments.list).toBeInstanceOf(
      ListInvestmentInstruments
    )
    expect(services.investments.instruments.create).toBeInstanceOf(
      CreateInvestmentInstrument
    )
    expect(services.investments.instruments.update).toBeInstanceOf(
      UpdateInvestmentInstrument
    )
    expect(services.investments.instruments.setStatus).toBeInstanceOf(
      SetInvestmentInstrumentStatus
    )
  })

  it("wires position commands and queries to dedicated use cases", () => {
    const services = createServices()

    expect(services.investments.positions.list).toBeInstanceOf(
      ListInvestmentPositions
    )
    expect(services.investments.positions.open).toBeInstanceOf(
      OpenInvestmentPosition
    )
    expect(services.investments.positions.openWithPurchase).toBeInstanceOf(
      OpenInvestmentPositionWithPurchase
    )
    expect(services.investments.positions.updateMetadata).toBeInstanceOf(
      UpdateInvestmentPositionMetadata
    )
  })

  it("wires the read-only operation preview", () => {
    const services = createServices()

    expect(services.investments.operations.list).toBeInstanceOf(
      ListInvestmentOperations
    )
    expect(services.investments.operations.preview).toBeInstanceOf(
      PreviewInvestmentOperation
    )
  })

  it("wires purchase and sale commands to their specialized use cases", () => {
    const services = createServices()

    expect(services.investments.operations.purchase).toBeInstanceOf(
      RecordInvestmentPurchase
    )
    expect(services.investments.operations.sale).toBeInstanceOf(
      RecordInvestmentSale
    )
  })

  it("wires income and amortization commands to their specialized use cases", () => {
    const services = createServices()

    expect(services.investments.operations.income).toBeInstanceOf(
      RecordInvestmentIncome
    )
    expect(services.investments.operations.amortization).toBeInstanceOf(
      RecordInvestmentAmortization
    )
  })

  it("wires investment expense instead of the generic expense command", () => {
    const services = createServices()

    expect(services.investments.operations.expense).toBeInstanceOf(
      RecordInvestmentExpense
    )
    expect(services.investments.operations.expense).not.toBe(
      services.expenses.record
    )
  })

  it("wires correction and cancellation to specialized investment use cases", () => {
    const services = createServices()

    expect(services.investments.operations.amend).toBeInstanceOf(
      AmendInvestmentOperation
    )
    expect(services.investments.operations.reverse).toBeInstanceOf(
      ReverseInvestmentOperation
    )
  })

  it("wires valuation history and recording", () => {
    const services = createServices()

    expect(services.investments.valuations.list).toBeInstanceOf(
      ListInvestmentValuations
    )
    expect(services.investments.valuations.record).toBeInstanceOf(
      RecordInvestmentValuation
    )
  })

  it("wires the portfolio summary to its dedicated query", () => {
    const services = createServices()

    expect(services.investments.portfolio.summary).toBeInstanceOf(
      GetInvestmentPortfolioSummary
    )
  })

  it("returns the persisted receipt for an idempotent retry through the facade", async () => {
    const query = vi.fn().mockResolvedValue([
      {
        book_id: "book-1",
        request_id: "request-1",
        format_version: 1,
        canonical_command: '{"bookId":"book-1","requestId":"request-1"}',
        result_json:
          '{"requestId":"request-1","positionId":"position-1","journalEntryIds":["entry-1"],"warnings":[]}',
        recorded_at: "2026-08-05T00:00:00.000Z",
      },
    ])
    const executor = {
      execute: vi.fn(),
      query,
      executeBatch: vi.fn(),
    }
    const database = {
      ...executor,
      transaction: async <T>(
        work: (transaction: typeof executor) => Promise<T>
      ) => work(executor),
      readTransaction: vi.fn(),
      close: vi.fn(),
    } as unknown as SqliteDatabase
    const services = createServices({ database })

    await expect(
      services.investments.requests.get({
        bookId: "book-1",
        requestId: "request-1",
      })
    ).resolves.toEqual({
      bookId: "book-1",
      requestId: "request-1",
      formatVersion: 1,
      canonicalCommand: '{"bookId":"book-1","requestId":"request-1"}',
      result: {
        requestId: "request-1",
        positionId: "position-1",
        journalEntryIds: ["entry-1"],
        warnings: [],
      },
      recordedAt: "2026-08-05T00:00:00.000Z",
    })
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("investment_request_receipts"),
      ["book-1", "request-1"]
    )
  })

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
      "investments",
    ])
    expect(Object.keys(services.books)).toEqual(["list", "get", "create"])
    expect(Object.keys(services.accounts)).toEqual([
      "listBalances",
      "create",
      "configure",
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
      "update",
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
    expect(services.accounts.configure).toBeInstanceOf(
      ConfigureFinancialAccount
    )
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
    expect(services.categories.update).toBeInstanceOf(UpdateCategory)
    expect(services.categories.archive).toBeInstanceOf(ArchiveCategory)
    expect(services.categories.reactivate).toBeInstanceOf(ReactivateCategory)
  })

  it("keeps category lifecycle handlers dedicated to managed categories", () => {
    const services = createServices()

    expect(services.categories.update).toBeInstanceOf(UpdateCategory)
    expect(services.categories.archive).toBeInstanceOf(ArchiveCategory)
    expect(services.categories.reactivate).toBeInstanceOf(ReactivateCategory)
    expect(services.categories.update).not.toBe(services.accounts.rename)
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
