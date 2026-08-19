import { DomainError, Result } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type { RepositoryContext } from "../ports/repositories.js"
import type { TransactionManager } from "../ports/transaction.js"
import { DomainEventDispatcher } from "./event-dispatcher.js"

export async function executeUseCase<T>(input: {
  readonly transactionManager: TransactionManager
  readonly eventDispatcher: DomainEventDispatcher
  readonly work: (repositories: RepositoryContext) => Promise<T>
}): Promise<Result<T, ApplicationError>> {
  try {
    const committed = await input.transactionManager.execute(input.work)
    await input.eventDispatcher.dispatch(committed.facts)
    return Result.ok(committed.value)
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
