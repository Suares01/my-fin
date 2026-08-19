import type {
  DomainFactCollector,
  RepositoryContext,
  TransactionManager,
} from "@workspace/application"
import type { DomainFact } from "@workspace/domain"
import { InMemoryFinancialBookRepository } from "../repositories/in-memory-financial-book-repository.js"
import { InMemoryJournalEntryRepository } from "../repositories/in-memory-journal-entry-repository.js"
import { InMemoryLedgerAccountRepository } from "../repositories/in-memory-ledger-account-repository.js"
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
