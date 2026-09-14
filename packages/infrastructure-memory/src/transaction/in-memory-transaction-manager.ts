import type {
  DomainFactCollector,
  RepositoryContext,
  TransactionManager,
} from "@workspace/application"
import type { DomainFact } from "@workspace/domain"
import { InMemoryFinancialBookRepository } from "../repositories/in-memory-financial-book-repository.js"
import { InMemoryInvestmentInstrumentRepository } from "../repositories/in-memory-investment-instrument-repository.js"
import { InMemoryInvestmentOperationRepository } from "../repositories/in-memory-investment-operation-repository.js"
import { InMemoryInvestmentPositionRepository } from "../repositories/in-memory-investment-position-repository.js"
import { InMemoryInvestmentRequestStore } from "../repositories/in-memory-investment-request-store.js"
import { InMemoryInvestmentSequenceStore } from "../repositories/in-memory-investment-sequence-store.js"
import { InMemoryInvestmentValuationStore } from "../repositories/in-memory-investment-valuation-store.js"
import { InMemoryJournalEntryRepository } from "../repositories/in-memory-journal-entry-repository.js"
import { InMemoryLedgerAccountRepository } from "../repositories/in-memory-ledger-account-repository.js"
import { InMemoryInvestmentTransactionReads } from "../queries/in-memory-investment-transaction-reads.js"
import { InMemoryStore } from "../store/in-memory-store.js"

class InMemoryFactCollector implements DomainFactCollector {
  private pendingFacts: DomainFact[] = []

  record(facts: readonly DomainFact[]): void {
    this.pendingFacts.push(...facts)
  }

  pull(): readonly DomainFact[] {
    const facts = this.pendingFacts
    this.pendingFacts = []
    return facts
  }
}

export class InMemoryTransactionManager implements TransactionManager {
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly store: InMemoryStore) {}

  execute<T>(
    work: (repositories: RepositoryContext) => Promise<T>
  ): Promise<{ readonly value: T; readonly facts: readonly DomainFact[] }> {
    const run = this.queue.then(() => this.runTransaction(work))
    this.queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async runTransaction<T>(
    work: (repositories: RepositoryContext) => Promise<T>
  ): Promise<{ readonly value: T; readonly facts: readonly DomainFact[] }> {
    const before = this.store.snapshot()
    const facts = new InMemoryFactCollector()
    const repositories: RepositoryContext = {
      books: new InMemoryFinancialBookRepository(this.store, facts),
      accounts: new InMemoryLedgerAccountRepository(this.store, facts),
      journalEntries: new InMemoryJournalEntryRepository(this.store, facts),
      investmentInstruments: new InMemoryInvestmentInstrumentRepository(
        this.store
      ),
      investmentPositions: new InMemoryInvestmentPositionRepository(this.store),
      investmentOperations: new InMemoryInvestmentOperationRepository(
        this.store
      ),
      investmentValuations: new InMemoryInvestmentValuationStore(this.store),
      investmentRequests: new InMemoryInvestmentRequestStore(this.store),
      investmentSequences: new InMemoryInvestmentSequenceStore(this.store),
      investmentReads: new InMemoryInvestmentTransactionReads(this.store),
      facts,
    }

    try {
      const value = await work(repositories)
      return { value, facts: facts.pull() }
    } catch (error: unknown) {
      this.store.restore(before)
      throw error
    }
  }
}
