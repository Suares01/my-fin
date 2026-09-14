import {
  bookIdFromString,
  investmentInstrumentIdFromString,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import { ApplicationError } from "../../ports/errors.js"
import type {
  SetInvestmentInstrumentStatusCommand,
  TransactionManager,
} from "../../ports/index.js"
import { toInvestmentInstrumentDto } from "./create-investment-instrument.js"

export class SetInvestmentInstrumentStatus {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: SetInvestmentInstrumentStatusCommand) {
    return executeUseCase({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null) throw notFound("Financial book", command.bookId)
        const lookup = await repositories.investmentInstruments.findById(
          book.id,
          investmentInstrumentIdFromString(command.instrumentId)
        )
        if (lookup.kind === "NOT_FOUND")
          throw notFound("Investment instrument", command.instrumentId)
        if (lookup.kind === "BOOK_MISMATCH") {
          throw new ApplicationError(
            "BOOK_MISMATCH",
            "Investment instrument does not belong to the requested book"
          )
        }
        if (lookup.value.version !== command.expectedVersion) {
          throw new ApplicationError(
            "OPTIMISTIC_CONCURRENCY_FAILURE",
            `Investment instrument ${command.instrumentId} has a conflicting version`
          )
        }
        if (command.status === "ARCHIVED") {
          lookup.value.archive(
            await repositories.investmentPositions.hasOpenForInstrument(
              book.id,
              lookup.value.id
            )
          )
        } else {
          lookup.value.reactivate()
        }
        if (lookup.value.version !== command.expectedVersion) {
          await repositories.investmentInstruments.save(
            lookup.value,
            command.expectedVersion
          )
          repositories.facts.record(lookup.value.pullDomainFacts())
        }
        return toInvestmentInstrumentDto(lookup.value)
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
