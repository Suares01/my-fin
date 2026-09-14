import type {
  DomainFactCollector,
  RepositoryContext,
} from "@workspace/application"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { SqliteFinancialBookRepository } from "./sqlite-financial-book-repository.js"
import { SqliteInvestmentInstrumentRepository } from "./sqlite-investment-instrument-repository.js"
import { SqliteInvestmentOperationRepository } from "./sqlite-investment-operation-repository.js"
import { SqliteInvestmentPositionRepository } from "./sqlite-investment-position-repository.js"
import { SqliteInvestmentRequestStore } from "./sqlite-investment-request-store.js"
import { SqliteInvestmentSequenceStore } from "./sqlite-investment-sequence-store.js"
import { SqliteInvestmentValuationStore } from "./sqlite-investment-valuation-store.js"
import { SqliteJournalEntryRepository } from "./sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "./sqlite-ledger-account-repository.js"
import { SqliteInvestmentTransactionReads } from "../queries/sqlite-investment-transaction-reads.js"

export function createSqliteRepositoryContext(
  executor: SqliteExecutor,
  facts: DomainFactCollector
): RepositoryContext {
  return {
    books: new SqliteFinancialBookRepository(executor, facts),
    accounts: new SqliteLedgerAccountRepository(executor, facts),
    journalEntries: new SqliteJournalEntryRepository(executor, facts),
    investmentInstruments: new SqliteInvestmentInstrumentRepository(executor),
    investmentPositions: new SqliteInvestmentPositionRepository(executor),
    investmentOperations: new SqliteInvestmentOperationRepository(executor),
    investmentValuations: new SqliteInvestmentValuationStore(executor),
    investmentRequests: new SqliteInvestmentRequestStore(executor),
    investmentSequences: new SqliteInvestmentSequenceStore(executor),
    investmentReads: new SqliteInvestmentTransactionReads(executor),
    facts,
  }
}
