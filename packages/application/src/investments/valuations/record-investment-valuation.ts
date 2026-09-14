import {
  bookIdFromString,
  investmentPositionIdFromString,
  InvestmentValuation,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { ApplicationError } from "../../ports/errors.js"
import { executeInvestmentRequest } from "../shared/execute-investment-request.js"
import type {
  Clock,
  IdGenerator,
  RecordInvestmentValuationCommand,
  TransactionManager,
} from "../../ports/index.js"

export class RecordInvestmentValuation {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: RecordInvestmentValuationCommand) {
    return executeInvestmentRequest({
      command,
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      clock: this.clock,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null) throw missing("Financial book")
        const lookup = await repositories.investmentPositions.findById(
          book.id,
          investmentPositionIdFromString(command.positionId)
        )
        if (lookup.kind === "NOT_FOUND") throw missing("Investment position")
        if (lookup.kind === "BOOK_MISMATCH") throw mismatch()
        const position = lookup.value
        if (position.allocationRevision !== command.expectedAllocationRevision)
          throw allocationChanged()
        assertValuedAt(command.valuedAt, this.clock.now())
        const snapshot = position.toSnapshot()
        const valuation = InvestmentValuation.create({
          id: this.ids.nextInvestmentValuationId(),
          bookId: book.id,
          positionId: position.id,
          allocationRevision: position.allocationRevision,
          valuedAt: command.valuedAt,
          valuedOn: command.valuedAt.slice(0, 10),
          recordedAt: this.clock.now(),
          recordSequence: await repositories.investmentSequences.next(book.id),
          ...(command.quantity === undefined
            ? {}
            : { quantity: command.quantity }),
          ...(command.unitPrice === undefined
            ? {}
            : { unitPrice: command.unitPrice }),
          currency: snapshot.currency,
          grossValueMinor: command.grossValueMinor,
          ...(command.netValueMinor === undefined
            ? {}
            : { netValueMinor: command.netValueMinor }),
          ...(command.withdrawableValueMinor === undefined
            ? {}
            : { withdrawableValueMinor: command.withdrawableValueMinor }),
          positionCurrency: snapshot.currency,
          ...(snapshot.quantity === undefined
            ? {}
            : { positionQuantity: snapshot.quantity }),
        })
        await repositories.investmentValuations.append(valuation.toSnapshot())
        return {
          requestId: command.requestId,
          positionId: position.id,
          positionVersion: position.version,
          allocationRevision: position.allocationRevision,
          valuationId: valuation.toSnapshot().id,
          journalEntryIds: [],
          warnings: [],
        }
      },
    })
  }
}

function assertValuedAt(value: string, now: string): void {
  const instant = new Date(value)
  if (
    typeof value !== "string" ||
    Number.isNaN(instant.getTime()) ||
    instant.toISOString() !== value ||
    value > now
  )
    throw new ApplicationError(
      "INVALID_INVESTMENT_DATE",
      "Investment valuation instant must be a non-future UTC instant"
    )
}

function missing(entity: string): ApplicationError {
  return new ApplicationError("ENTITY_NOT_FOUND", `${entity} was not found`)
}

function mismatch(): ApplicationError {
  return new ApplicationError(
    "BOOK_MISMATCH",
    "Investment position does not belong to the requested book"
  )
}

function allocationChanged(): ApplicationError {
  return new ApplicationError(
    "INVESTMENT_ALLOCATION_CHANGED",
    "Investment position allocation changed before valuation was recorded"
  )
}
