import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  GetCategoryDetail,
  GetFinancialBook,
  GetJournalChainDetail,
  GetCategorySpending,
  GetMonthlyCashFlow,
  GetNetWorth,
  ArchiveLedgerAccount,
  DomainEventDispatcher,
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
  type Clock,
  type DomainEventPublisher,
  type IdGenerator,
} from "@workspace/application"
import {
  SqliteBookCatalogQueries,
  SqliteCategoryCatalogQueries,
  SqliteFinancialBookRepository,
  SqliteInsightQueries,
  SqliteLedgerAccountRepository,
  SqliteLedgerQueries,
  SqliteJournalViewQueries,
  SqliteTransactionManager,
  type SqliteDatabase,
} from "@workspace/infrastructure-sqlite"

export interface MyFinServices {
  readonly books: {
    readonly list: ListFinancialBooks
    readonly get: GetFinancialBook
    readonly create: CreateFinancialBook
  }
  readonly accounts: {
    readonly listBalances: ListAccountBalances
    readonly create: CreateFinancialAccount
    readonly setOpeningBalance: SetOpeningBalance
    readonly listStatement: ListAccountStatement
    readonly rename: RenameLedgerAccount
    readonly archive: ArchiveLedgerAccount
    readonly reactivate: ReactivateLedgerAccount
  }
  readonly categories: {
    readonly list: ListCategories
    readonly listIncome: ListIncomeCategories
    readonly listExpenses: ListExpenseCategories
    readonly get: GetCategoryDetail
    readonly createIncome: CreateIncomeCategory
    readonly createExpense: CreateExpenseCategory
    readonly rename: RenameLedgerAccount
    readonly archive: ArchiveLedgerAccount
    readonly reactivate: ReactivateLedgerAccount
  }
  readonly income: {
    readonly record: RecordIncome
  }
  readonly expenses: {
    readonly record: RecordExpense
  }
  readonly transfers: {
    readonly record: TransferMoney
  }
  readonly journal: {
    readonly list: ListJournalEntries
    readonly listChains: ListJournalChains
    readonly getChain: GetJournalChainDetail
    readonly reverse: ReverseJournalEntry
    readonly amend: AmendJournalEntry
  }
  readonly insights: {
    readonly netWorth: GetNetWorth
    readonly monthlyCashFlow: GetMonthlyCashFlow
    readonly categorySpending: GetCategorySpending
  }
}

export type CreateServicesOptions = {
  readonly database: SqliteDatabase
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly publisher: DomainEventPublisher
}

export function createMyFinServices(
  options: CreateServicesOptions
): MyFinServices {
  const transactionManager = new SqliteTransactionManager(options.database)
  const eventDispatcher = new DomainEventDispatcher(
    options.clock,
    options.ids,
    options.publisher
  )
  const booksRepository = new SqliteFinancialBookRepository(options.database)
  const accountsRepository = new SqliteLedgerAccountRepository(options.database)
  const ledgerQueries = new SqliteLedgerQueries(options.database)
  const journalViewQueries = new SqliteJournalViewQueries(options.database)
  const insightQueries = new SqliteInsightQueries(options.database)
  const bookCatalogQueries = new SqliteBookCatalogQueries(options.database)
  const categoryCatalogQueries = new SqliteCategoryCatalogQueries(
    options.database
  )

  return {
    books: {
      list: new ListFinancialBooks(bookCatalogQueries),
      get: new GetFinancialBook(bookCatalogQueries),
      create: new CreateFinancialBook(
        transactionManager,
        eventDispatcher,
        options.ids
      ),
    },
    accounts: {
      listBalances: new ListAccountBalances(booksRepository, ledgerQueries),
      create: new CreateFinancialAccount(
        transactionManager,
        eventDispatcher,
        options.ids
      ),
      setOpeningBalance: new SetOpeningBalance(
        transactionManager,
        eventDispatcher,
        options.ids,
        options.clock
      ),
      listStatement: new ListAccountStatement(
        accountsRepository,
        ledgerQueries
      ),
      rename: new RenameLedgerAccount(transactionManager, eventDispatcher),
      archive: new ArchiveLedgerAccount(transactionManager, eventDispatcher),
      reactivate: new ReactivateLedgerAccount(
        transactionManager,
        eventDispatcher
      ),
    },
    categories: {
      list: new ListCategories(booksRepository, categoryCatalogQueries),
      listIncome: new ListIncomeCategories(
        booksRepository,
        categoryCatalogQueries
      ),
      listExpenses: new ListExpenseCategories(
        booksRepository,
        categoryCatalogQueries
      ),
      get: new GetCategoryDetail(booksRepository, categoryCatalogQueries),
      createIncome: new CreateIncomeCategory(
        transactionManager,
        eventDispatcher,
        options.ids
      ),
      createExpense: new CreateExpenseCategory(
        transactionManager,
        eventDispatcher,
        options.ids
      ),
      rename: new RenameLedgerAccount(transactionManager, eventDispatcher),
      archive: new ArchiveLedgerAccount(transactionManager, eventDispatcher),
      reactivate: new ReactivateLedgerAccount(
        transactionManager,
        eventDispatcher
      ),
    },
    income: {
      record: new RecordIncome(
        transactionManager,
        eventDispatcher,
        options.ids,
        options.clock
      ),
    },
    expenses: {
      record: new RecordExpense(
        transactionManager,
        eventDispatcher,
        options.ids,
        options.clock
      ),
    },
    transfers: {
      record: new TransferMoney(
        transactionManager,
        eventDispatcher,
        options.ids,
        options.clock
      ),
    },
    journal: {
      list: new ListJournalEntries(booksRepository, ledgerQueries),
      listChains: new ListJournalChains(booksRepository, journalViewQueries),
      getChain: new GetJournalChainDetail(booksRepository, journalViewQueries),
      reverse: new ReverseJournalEntry(
        transactionManager,
        eventDispatcher,
        options.ids,
        options.clock
      ),
      amend: new AmendJournalEntry(
        transactionManager,
        eventDispatcher,
        options.ids,
        options.clock
      ),
    },
    insights: {
      netWorth: new GetNetWorth(booksRepository, insightQueries),
      monthlyCashFlow: new GetMonthlyCashFlow(booksRepository, insightQueries),
      categorySpending: new GetCategorySpending(
        booksRepository,
        insightQueries
      ),
    },
  }
}
