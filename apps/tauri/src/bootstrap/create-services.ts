import {
  CreateExpenseCategory,
  ArchiveCategory,
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
  getInvestmentRequestResult,
  type Clock,
  type DomainEventPublisher,
  type IdGenerator,
  type InvestmentRequestReceipt,
} from "@workspace/application"
import {
  SqliteBookCatalogQueries,
  SqliteCategoryCatalogQueries,
  SqliteFinancialBookRepository,
  SqliteInsightQueries,
  SqliteInvestmentAccountQueries,
  SqliteInvestmentInstrumentQueries,
  SqliteInvestmentOperationQueries,
  SqliteInvestmentPortfolioSummary,
  SqliteInvestmentPositionQueries,
  SqliteInvestmentValuationQueries,
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
    readonly update: UpdateCategory
    readonly archive: ArchiveCategory
    readonly reactivate: ReactivateCategory
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
    readonly summary: GetJournalChainSummary
    readonly getChain: GetJournalChainDetail
    readonly reverse: ReverseJournalEntry
    readonly amend: AmendJournalEntry
  }
  readonly insights: {
    readonly netWorth: GetNetWorth
    readonly monthlyCashFlow: GetMonthlyCashFlow
    readonly categorySpending: GetCategorySpending
  }
  readonly investments: {
    readonly accounts: {
      readonly list: ListInvestmentAccounts
      readonly setOpeningBalance: SetInvestmentOpeningBalance
    }
    readonly instruments: {
      readonly list: ListInvestmentInstruments
      readonly create: CreateInvestmentInstrument
      readonly update: UpdateInvestmentInstrument
      readonly setStatus: SetInvestmentInstrumentStatus
    }
    readonly positions: {
      readonly list: ListInvestmentPositions
      readonly open: OpenInvestmentPosition
      readonly updateMetadata: UpdateInvestmentPositionMetadata
    }
    readonly operations: {
      readonly list: ListInvestmentOperations
      readonly preview: PreviewInvestmentOperation
      readonly purchase: RecordInvestmentPurchase
      readonly sale: RecordInvestmentSale
      readonly income: RecordInvestmentIncome
      readonly amortization: RecordInvestmentAmortization
      readonly expense: RecordInvestmentExpense
      readonly amend: AmendInvestmentOperation
      readonly reverse: ReverseInvestmentOperation
    }
    readonly valuations: {
      readonly list: ListInvestmentValuations
      readonly record: RecordInvestmentValuation
    }
    readonly portfolio: { readonly summary: GetInvestmentPortfolioSummary }
    readonly requests: {
      readonly get: (input: {
        readonly bookId: string
        readonly requestId: string
      }) => Promise<InvestmentRequestReceipt | null>
    }
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
  const investmentAccountQueries = new SqliteInvestmentAccountQueries(
    options.database
  )
  const investmentInstrumentQueries = new SqliteInvestmentInstrumentQueries(
    options.database
  )
  const investmentPositionQueries = new SqliteInvestmentPositionQueries(
    options.database
  )
  const investmentOperationQueries = new SqliteInvestmentOperationQueries(
    options.database
  )
  const investmentValuationQueries = new SqliteInvestmentValuationQueries(
    options.database
  )
  const investmentPortfolioSummary = new SqliteInvestmentPortfolioSummary(
    options.database
  )
  const investmentQueries = {
    listPositions: investmentPositionQueries.listPositions.bind(
      investmentPositionQueries
    ),
    listOperations: investmentOperationQueries.listOperations.bind(
      investmentOperationQueries
    ),
    listValuations: investmentValuationQueries.listValuations.bind(
      investmentValuationQueries
    ),
  }
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
      update: new UpdateCategory(transactionManager, eventDispatcher),
      archive: new ArchiveCategory(transactionManager, eventDispatcher),
      reactivate: new ReactivateCategory(transactionManager, eventDispatcher),
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
      summary: new GetJournalChainSummary(booksRepository, journalViewQueries),
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
    investments: {
      accounts: {
        list: new ListInvestmentAccounts(
          booksRepository,
          investmentAccountQueries,
          options.clock
        ),
        setOpeningBalance: new SetInvestmentOpeningBalance(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
      },
      instruments: {
        list: new ListInvestmentInstruments(
          booksRepository,
          investmentInstrumentQueries
        ),
        create: new CreateInvestmentInstrument(
          transactionManager,
          eventDispatcher,
          options.ids
        ),
        update: new UpdateInvestmentInstrument(
          transactionManager,
          eventDispatcher
        ),
        setStatus: new SetInvestmentInstrumentStatus(
          transactionManager,
          eventDispatcher
        ),
      },
      positions: {
        list: new ListInvestmentPositions(booksRepository, investmentQueries),
        open: new OpenInvestmentPosition(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        updateMetadata: new UpdateInvestmentPositionMetadata(
          transactionManager,
          eventDispatcher
        ),
      },
      operations: {
        list: new ListInvestmentOperations(booksRepository, investmentQueries),
        preview: new PreviewInvestmentOperation(transactionManager),
        purchase: new RecordInvestmentPurchase(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        sale: new RecordInvestmentSale(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        income: new RecordInvestmentIncome(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        amortization: new RecordInvestmentAmortization(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        expense: new RecordInvestmentExpense(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        amend: new AmendInvestmentOperation(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
        reverse: new ReverseInvestmentOperation(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
      },
      valuations: {
        list: new ListInvestmentValuations(booksRepository, investmentQueries),
        record: new RecordInvestmentValuation(
          transactionManager,
          eventDispatcher,
          options.ids,
          options.clock
        ),
      },
      portfolio: {
        summary: new GetInvestmentPortfolioSummary(
          booksRepository,
          investmentPortfolioSummary,
          options.clock
        ),
      },
      requests: {
        get: ({ bookId, requestId }) =>
          getInvestmentRequestResult({ transactionManager, bookId, requestId }),
      },
    },
  }
}
