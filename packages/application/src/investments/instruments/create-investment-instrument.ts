import {
  bookIdFromString,
  INSTRUMENT_IDENTIFIER_SCHEMES,
  InvestmentInstrument,
  INVESTMENT_INSTRUMENT_TYPES,
  type InstrumentIdentifierScheme,
  type InstrumentIdentifierSnapshot,
  type InvestmentInstrumentType,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import { ApplicationError } from "../../ports/errors.js"
import type {
  CreateInvestmentInstrumentCommand,
  IdGenerator,
  InvestmentInstrumentDto,
  TransactionManager,
} from "../../ports/index.js"

export class CreateInvestmentInstrument {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator
  ) {}

  async execute(command: CreateInvestmentInstrumentCommand) {
    return executeUseCase<InvestmentInstrumentDto>({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${command.bookId} was not found`
          )
        }
        if (!isInstrumentType(command.type)) {
          throw new ApplicationError(
            "INVALID_INVESTMENT_INPUT",
            "Investment instrument type is invalid"
          )
        }
        if (
          command.identifiers?.some(
            (identifier) => !isIdentifierScheme(identifier.scheme)
          )
        ) {
          throw new ApplicationError(
            "INVALID_INVESTMENT_INPUT",
            "Investment instrument identifier scheme is invalid"
          )
        }

        const instrument = InvestmentInstrument.create({
          id: this.ids.nextInvestmentInstrumentId(),
          bookId: book.id,
          name: command.name,
          type: command.type,
          currency: command.currency,
          baseCurrency: book.baseCurrency.code,
          ...(command.issuerName === undefined
            ? {}
            : { issuerName: command.issuerName }),
          ...(command.identifiers === undefined
            ? {}
            : {
                identifiers: command.identifiers.map((identifier) => ({
                  ...identifier,
                  scheme: identifier.scheme as InstrumentIdentifierScheme,
                })) as InstrumentIdentifierSnapshot[],
              }),
        })
        for (const identifier of instrument.toSnapshot().identifiers) {
          if (
            await repositories.investmentInstruments.existsWithIdentifier(
              book.id,
              identifier
            )
          ) {
            throw new ApplicationError(
              "DUPLICATE_INSTRUMENT_IDENTIFIER",
              "Investment instrument identifier already exists"
            )
          }
        }
        await repositories.investmentInstruments.add(instrument)
        repositories.facts.record(instrument.pullDomainFacts())
        return toInvestmentInstrumentDto(instrument)
      },
    })
  }
}

export function toInvestmentInstrumentDto(
  instrument: InvestmentInstrument
): InvestmentInstrumentDto {
  const snapshot = instrument.toSnapshot()
  return {
    id: snapshot.id,
    bookId: snapshot.bookId,
    name: snapshot.name,
    type: snapshot.type,
    instrumentClass: instrument.instrumentClass,
    currency: snapshot.currency,
    ...(snapshot.issuerName === undefined
      ? {}
      : { issuerName: snapshot.issuerName }),
    identifiers: snapshot.identifiers,
    status: snapshot.status,
    version: snapshot.version,
  }
}

function isInstrumentType(value: string): value is InvestmentInstrumentType {
  return (INVESTMENT_INSTRUMENT_TYPES as readonly string[]).includes(value)
}

function isIdentifierScheme(
  value: string
): value is InstrumentIdentifierScheme {
  return (INSTRUMENT_IDENTIFIER_SCHEMES as readonly string[]).includes(value)
}
