import type { RepositoryContext } from "./repositories.js"

export interface CommittedTransaction<T> {
  readonly value: T
  readonly facts: readonly import("@workspace/domain").DomainFact[]
}

export interface TransactionManager {
  execute<T>(
    work: (repositories: RepositoryContext) => Promise<T>
  ): Promise<CommittedTransaction<T>>
}
