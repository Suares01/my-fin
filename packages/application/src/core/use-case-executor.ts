import { DomainError, Result } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type { RepositoryContext } from "../ports/repositories.js"
import type { TransactionManager } from "../ports/transaction.js"
import { DomainEventDispatcher } from "./event-dispatcher.js"

export async function executeUseCase<T>(input: {
  readonly transactionManager: TransactionManager
  readonly eventDispatcher: DomainEventDispatcher
  readonly work: (repositories: RepositoryContext) => Promise<T>
  /** Opt in for idempotent investment commands: commit success remains success. */
  readonly preserveCommitted?: boolean
  readonly reportPostCommitFailure?: (
    error: ApplicationError
  ) => Promise<void> | void
}): Promise<Result<T, ApplicationError>> {
  let committed: T
  try {
    const transaction = await input.transactionManager.execute(input.work)
    committed = transaction.value
    try {
      await input.eventDispatcher.dispatch(transaction.facts)
    } catch (error: unknown) {
      const applicationError = toApplicationError(error)
      try {
        await input.reportPostCommitFailure?.(applicationError)
      } catch {
        // A reporter must not turn a known committed investment mutation into a retry.
      }
      if (input.preserveCommitted === true) return Result.ok(committed)
      return Result.fail(applicationError)
    }
    return Result.ok(committed)
  } catch (error: unknown) {
    return Result.fail(toApplicationError(error))
  }
}

export function toApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error
  }

  if (error instanceof DomainError) {
    return new ApplicationError(error.code, error.message, error.details)
  }

  if (error instanceof Error) {
    return new ApplicationError("UNEXPECTED_ERROR", error.message)
  }

  return new ApplicationError(
    "UNEXPECTED_ERROR",
    "Unexpected application error"
  )
}
