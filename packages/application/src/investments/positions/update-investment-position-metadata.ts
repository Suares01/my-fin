import {
  bookIdFromString,
  investmentPositionIdFromString,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import { ApplicationError } from "../../ports/errors.js"
import type {
  InvestmentPositionMetadataDto,
  TransactionManager,
  UpdateInvestmentPositionMetadataCommand,
} from "../../ports/index.js"

export class UpdateInvestmentPositionMetadata {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}
  async execute(command: UpdateInvestmentPositionMetadataCommand) {
    return executeUseCase<InvestmentPositionMetadataDto>({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null) throw notFound("Financial book", command.bookId)
        const lookup = await repositories.investmentPositions.findById(
          book.id,
          investmentPositionIdFromString(command.positionId)
        )
        if (lookup.kind === "NOT_FOUND")
          throw notFound("Investment position", command.positionId)
        if (lookup.kind === "BOOK_MISMATCH")
          throw new ApplicationError(
            "BOOK_MISMATCH",
            "Investment position does not belong to the requested book"
          )
        if (lookup.value.version !== command.expectedVersion)
          throw new ApplicationError(
            "OPTIMISTIC_CONCURRENCY_FAILURE",
            `Investment position ${command.positionId} has a conflicting version`
          )
        lookup.value.updateLabel(command.label)
        if (lookup.value.version !== command.expectedVersion) {
          await repositories.investmentPositions.save(
            lookup.value,
            command.expectedVersion
          )
          repositories.facts.record(lookup.value.pullDomainFacts())
        }
        const snapshot = lookup.value.toSnapshot()
        return {
          id: lookup.value.id,
          bookId: lookup.value.bookId,
          ...(snapshot.label === undefined ? {} : { label: snapshot.label }),
          version: lookup.value.version,
        }
      },
    })
  }
}
function notFound(entity: string, id: string): ApplicationError {
  return new ApplicationError(
    "ENTITY_NOT_FOUND",
    `${entity} ${id} was not found`
  )
}
