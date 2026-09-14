import { bookIdFromString } from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import { ApplicationError } from "../../ports/errors.js"
import type {
  Clock,
  InvestmentMutationResult,
  InvestmentRequest,
  RepositoryContext,
  TransactionManager,
} from "../../ports/index.js"

export async function executeInvestmentRequest<
  T extends InvestmentRequest,
>(input: {
  readonly command: T
  readonly transactionManager: TransactionManager
  readonly eventDispatcher: DomainEventDispatcher
  readonly clock: Clock
  readonly work: (
    repositories: RepositoryContext
  ) => Promise<InvestmentMutationResult>
}) {
  const canonicalCommand = canonicalize(input.command)
  return executeUseCase({
    transactionManager: input.transactionManager,
    eventDispatcher: input.eventDispatcher,
    preserveCommitted: true,
    work: async (repositories) => {
      const bookId = bookIdFromString(input.command.bookId)
      const prior = await repositories.investmentRequests.find(
        bookId,
        input.command.requestId
      )
      if (prior !== null) {
        if (prior.canonicalCommand !== canonicalCommand)
          throw new ApplicationError(
            "IDEMPOTENCY_CONFLICT",
            "Request ID was reused with different content"
          )
        return prior.result
      }
      const result = await input.work(repositories)
      await repositories.investmentRequests.add({
        bookId,
        requestId: input.command.requestId,
        formatVersion: 1,
        canonicalCommand,
        result,
        recordedAt: input.clock.now(),
      })
      return result
    },
  })
}

export async function getInvestmentRequestResult(input: {
  readonly transactionManager: TransactionManager
  readonly bookId: string
  readonly requestId: string
}) {
  return input.transactionManager
    .execute(async (repositories) =>
      repositories.investmentRequests.find(
        bookIdFromString(input.bookId),
        input.requestId
      )
    )
    .then((value) => value.value)
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`
      )
      .join(",")}}`
  return JSON.stringify(value)
}
