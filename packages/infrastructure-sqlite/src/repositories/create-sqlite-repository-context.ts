import type {
  DomainFactCollector,
  RepositoryContext,
} from "@workspace/application"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { SqliteFinancialBookRepository } from "./sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "./sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "./sqlite-ledger-account-repository.js"

export function createSqliteRepositoryContext(
  executor: SqliteExecutor,
  facts: DomainFactCollector
): RepositoryContext {
  return {
    books: new SqliteFinancialBookRepository(executor, facts),
    accounts: new SqliteLedgerAccountRepository(executor, facts),
    journalEntries: new SqliteJournalEntryRepository(executor, facts),
    facts,
  }
}
