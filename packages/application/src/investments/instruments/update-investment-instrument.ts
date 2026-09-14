import {
  bookIdFromString,
  INSTRUMENT_IDENTIFIER_SCHEMES,
  investmentInstrumentIdFromString,
  INVESTMENT_INSTRUMENT_TYPES,
  type InstrumentIdentifierScheme,
  type InstrumentIdentifierSnapshot,
  type InvestmentInstrumentType,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import { ApplicationError } from "../../ports/errors.js"
import type {
  TransactionManager,
  UpdateInvestmentInstrumentCommand,
} from "../../ports/index.js"
import { toInvestmentInstrumentDto } from "./create-investment-instrument.js"

export class UpdateInvestmentInstrument {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: UpdateInvestmentInstrumentCommand) {
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
        if (!isInstrumentType(command.type) || !isIdentifierList(command)) {
          throw new ApplicationError(
            "INVALID_INVESTMENT_INPUT",
            "Investment instrument input is invalid"
          )
        }
        if (command.currency !== book.baseCurrency.code) {
          throw new ApplicationError(
            "INVESTMENT_CURRENCY_MISMATCH",
            "Instrument currency must match the book currency"
          )
        }
        const identifiers = command.identifiers.map((identifier) => ({
          ...identifier,
          scheme: identifier.scheme as InstrumentIdentifierScheme,
        })) as InstrumentIdentifierSnapshot[]
        const hasHistoricalPosition =
          await repositories.investmentPositions.hasAnyForInstrument(
            book.id,
            lookup.value.id
          )
        lookup.value.update(
          {
            name: command.name,
            type: command.type,
            currency: command.currency,
            ...(command.issuerName === undefined
              ? {}
              : { issuerName: command.issuerName }),
            identifiers,
          },
          hasHistoricalPosition
        )
        for (const identifier of lookup.value.toSnapshot().identifiers) {
          if (
            await repositories.investmentInstruments.existsWithIdentifier(
              book.id,
              identifier,
              lookup.value.id
            )
          ) {
            throw new ApplicationError(
              "DUPLICATE_INSTRUMENT_IDENTIFIER",
              "Investment instrument identifier already exists"
            )
          }
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

function isInstrumentType(value: string): value is InvestmentInstrumentType {
  return (INVESTMENT_INSTRUMENT_TYPES as readonly string[]).includes(value)
}

function isIdentifierList(command: UpdateInvestmentInstrumentCommand): boolean {
  return command.identifiers.every((identifier) =>
    (INSTRUMENT_IDENTIFIER_SCHEMES as readonly string[]).includes(
      identifier.scheme
    )
  )
}
