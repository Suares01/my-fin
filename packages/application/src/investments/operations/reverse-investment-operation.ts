import {
  bookIdFromString,
  InvestmentOperation,
  investmentOperationIdFromString,
  LocalDate,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { ApplicationError } from "../../ports/errors.js"
import { executeInvestmentRequest } from "../shared/execute-investment-request.js"
import type {
  Clock,
  CorrectInvestmentOperationCommand,
  IdGenerator,
  TransactionManager,
} from "../../ports/index.js"

/** Cancels the last effective operation, preserving an append-only audit trail. */
export class ReverseInvestmentOperation {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: CorrectInvestmentOperationCommand) {
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

        const lookup = await repositories.investmentOperations.findById(
          book.id,
          investmentOperationIdFromString(command.operationId)
        )
        if (lookup.kind === "NOT_FOUND") throw missing("Investment operation")
        if (lookup.kind === "BOOK_MISMATCH")
          throw mismatch("Investment operation")
        const original = lookup.value
        if (original.version !== command.expectedOperationVersion)
          throw concurrent("Investment operation")
        const originalSnapshot = original.toSnapshot()

        const positionLookup = await repositories.investmentPositions.findById(
          book.id,
          originalSnapshot.positionId
        )
        if (positionLookup.kind === "NOT_FOUND")
          throw missing("Investment position")
        if (positionLookup.kind === "BOOK_MISMATCH")
          throw mismatch("Investment position")
        const position = positionLookup.value
        if (position.version !== command.expectedPositionVersion)
          throw concurrent("Investment position")

        const last = await repositories.investmentOperations.findLastEffective(
          book.id,
          position.id
        )
        if (last?.id !== original.id) throw notCorrectable()

        const restoringOpen =
          originalSnapshot.positionBefore.kind === "EXISTING" &&
          originalSnapshot.positionBefore.status === "OPEN"
        if (restoringOpen) {
          const account = await repositories.accounts.findById(
            position.toSnapshot().investmentAccountId
          )
          const instrument = await repositories.investmentInstruments.findById(
            book.id,
            position.toSnapshot().instrumentId
          )
          if (account === null || instrument.kind !== "FOUND")
            throw new ApplicationError(
              "INVESTMENT_ENTITY_NOT_ACTIVE",
              "Investment entities must be active to reopen a position"
            )
          position.assertCanReopen(
            account.status === "ACTIVE",
            instrument.value.status === "ACTIVE"
          )
        }

        const originalJournal =
          originalSnapshot.journalEntryId === undefined
            ? undefined
            : await repositories.journalEntries.findById(
                originalSnapshot.journalEntryId
              )
        if (originalJournal != null && originalJournal.bookId !== book.id)
          throw mismatch("Investment journal entry")
        if (
          originalSnapshot.journalEntryId !== undefined &&
          originalJournal === null
        )
          throw missing("Investment journal entry")

        const journalReversal =
          originalJournal == null
            ? undefined
            : originalJournal.createReversal({
                id: this.ids.nextJournalEntryId(),
                occurredOn: LocalDate.parse(originalSnapshot.occurredOn),
                recordedAt: this.clock.now(),
                sequence: await repositories.journalEntries.reserveNextSequence(
                  book.id
                ),
                description: command.reason,
                postingIds: originalJournal.postings.map(() =>
                  this.ids.nextPostingId()
                ),
              })
        const operationReversal = InvestmentOperation.createReversal({
          id: this.ids.nextInvestmentOperationId(),
          original: originalSnapshot,
          recordedAt: this.clock.now(),
          sequence: await repositories.investmentSequences.next(book.id),
          ...(journalReversal === undefined
            ? {}
            : { journalEntryId: journalReversal.id }),
        })

        if (originalSnapshot.positionBefore.kind === "UNOPENED")
          position.applyCorrection({
            state: "UNOPENED",
            occurredOn: originalSnapshot.occurredOn,
          })
        else
          position.applyCorrection({
            quantity: originalSnapshot.positionBefore.quantity,
            bookCostMinor: originalSnapshot.positionBefore.bookCostMinor,
            occurredOn: originalSnapshot.occurredOn,
          })

        if (journalReversal !== undefined && originalJournal != null) {
          originalJournal.markReversedBy(journalReversal.id)
          await repositories.journalEntries.add(journalReversal)
          await repositories.journalEntries.save(
            originalJournal,
            originalJournal.version - 1
          )
        }
        await repositories.investmentOperations.add(operationReversal)
        original.markReversedBy(operationReversal.id)
        await repositories.investmentOperations.saveLineage(
          original,
          command.expectedOperationVersion
        )
        await repositories.investmentPositions.save(
          position,
          command.expectedPositionVersion
        )
        repositories.facts.record(position.pullDomainFacts())
        repositories.facts.record(original.pullDomainFacts())
        repositories.facts.record(operationReversal.pullDomainFacts())
        if (journalReversal !== undefined)
          repositories.facts.record(journalReversal.pullDomainFacts())
        return {
          requestId: command.requestId,
          positionId: position.id,
          positionVersion: position.version,
          allocationRevision: position.allocationRevision,
          operationId: original.id,
          reversalOperationId: operationReversal.id,
          journalEntryIds:
            journalReversal === undefined ? [] : [journalReversal.id],
          warnings: await warnings(
            repositories,
            book.id,
            position.toSnapshot().investmentAccountId,
            originalSnapshot.occurredOn
          ),
        }
      },
    })
  }
}

async function warnings(
  repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0],
  bookId: string,
  accountId: string,
  asOf: string
) {
  return (
    await repositories.investmentReads.accountCash(
      bookId as never,
      [accountId as never],
      asOf
    )
  )
    .filter((value) => BigInt(value.cashMinor) < 0n)
    .map((value) => ({
      code: "INVESTMENT_CASH_NEGATIVE" as const,
      investmentAccountId: value.investmentAccountId,
      cashMinor: value.cashMinor,
      currency: value.currency,
      asOf,
    }))
}
function missing(subject: string) {
  return new ApplicationError("ENTITY_NOT_FOUND", `${subject} was not found`)
}
function mismatch(subject: string) {
  return new ApplicationError(
    "BOOK_MISMATCH",
    `${subject} does not belong to book`
  )
}
function concurrent(subject: string) {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    `${subject} has a conflicting version`
  )
}
function notCorrectable() {
  return new ApplicationError(
    "INVESTMENT_OPERATION_NOT_CORRECTABLE",
    "Investment operation is not the last effective operation"
  )
}
