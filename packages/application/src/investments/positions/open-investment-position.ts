import {
  assertRequiredBookCost,
  bookIdFromString,
  Currency,
  InvestmentOperation,
  InvestmentPosition,
  Money,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { ApplicationError } from "../../ports/errors.js"
import { executeInvestmentRequest } from "../shared/execute-investment-request.js"
import type {
  Clock,
  IdGenerator,
  OpenInvestmentPositionCommand,
  TransactionManager,
} from "../../ports/index.js"

export class OpenInvestmentPosition {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: OpenInvestmentPositionCommand) {
    return executeInvestmentRequest({
      command,
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      clock: this.clock,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null) throw notFound("Financial book", command.bookId)

        const account = await repositories.accounts.findById(
          command.investmentAccountId as never
        )
        if (account === null)
          throw notFound("Investment account", command.investmentAccountId)
        if (account.bookId !== book.id) throw bookMismatch("Investment account")
        if (
          account.status !== "ACTIVE" ||
          account.financialAccount?.type !== "INVESTMENT_ACCOUNT"
        )
          throw inactive()

        const instrument = await repositories.investmentInstruments.findById(
          book.id,
          command.instrumentId as never
        )
        if (instrument.kind === "NOT_FOUND")
          throw notFound("Investment instrument", command.instrumentId)
        if (instrument.kind === "BOOK_MISMATCH")
          throw bookMismatch("Investment instrument")
        if (instrument.value.status !== "ACTIVE") throw inactive()

        const amount = optionalMoney(
          command.bookCostMinor,
          book.baseCurrency.code
        )
        const requiredCost = assertRequiredBookCost(amount)
        const position = InvestmentPosition.openWithAllocation({
          id: this.ids.nextInvestmentPositionId(),
          bookId: book.id,
          investmentAccountId: account.id,
          instrumentId: instrument.value.id,
          instrumentClass: instrument.value.instrumentClass,
          ...(command.label === undefined ? {} : { label: command.label }),
          quantityMode: command.quantityMode,
          ...(command.quantity === undefined
            ? {}
            : { quantity: command.quantity }),
          bookCostMinor: requiredCost.amountMinor.toString(),
          currency: book.baseCurrency.code,
          openedOn: command.occurredOn,
          ...(command.fixedIncomeTerms === undefined
            ? {}
            : { fixedIncomeTerms: command.fixedIncomeTerms as never }),
        })
        const positionSnapshot = position.toSnapshot()
        const operation = InvestmentOperation.record({
          id: this.ids.nextInvestmentOperationId(),
          bookId: book.id,
          positionId: position.id,
          type: "OPENING_ALLOCATION",
          occurredOn: command.occurredOn,
          recordedAt: this.clock.now(),
          sequence: await repositories.investmentSequences.next(book.id),
          description: "Opening allocation",
          currency: book.baseCurrency.code,
          ...(positionSnapshot.quantity === undefined
            ? {}
            : { quantityDelta: positionSnapshot.quantity }),
          bookCostDeltaMinor: positionSnapshot.bookCostMinor,
          grossAmountMinor: "0",
          feesMinor: "0",
          taxesMinor: "0",
          netCashFlowMinor: "0",
          cashMode: "NONE",
          categories: {},
          positionBefore: { kind: "UNOPENED" },
        })
        await repositories.investmentPositions.add(position)
        await repositories.investmentOperations.add(operation)
        repositories.facts.record(position.pullDomainFacts())
        repositories.facts.record(operation.pullDomainFacts())

        const cash = await repositories.investmentReads.accountCash(
          book.id,
          [account.id],
          command.occurredOn
        )
        return {
          requestId: command.requestId,
          positionId: position.id,
          positionVersion: position.version,
          allocationRevision: position.allocationRevision,
          operationId: operation.id,
          journalEntryIds: [],
          warnings: cash
            .filter((state) => BigInt(state.cashMinor) < 0n)
            .map((state) => ({
              code: "INVESTMENT_CASH_NEGATIVE" as const,
              investmentAccountId: state.investmentAccountId,
              cashMinor: state.cashMinor,
              currency: state.currency,
              asOf: command.occurredOn,
            })),
        }
      },
    })
  }
}

function optionalMoney(value: unknown, currency: string): Money | undefined {
  if (typeof value !== "string") return undefined
  if (!/^-?\d+$/.test(value)) return Money.of(0n, Currency.parse(currency))
  return Money.of(BigInt(value), Currency.parse(currency))
}

function notFound(entity: string, id: string): ApplicationError {
  return new ApplicationError(
    "ENTITY_NOT_FOUND",
    `${entity} ${id} was not found`
  )
}

function bookMismatch(entity: string): ApplicationError {
  return new ApplicationError(
    "BOOK_MISMATCH",
    `${entity} does not belong to the requested book`
  )
}

function inactive(): ApplicationError {
  return new ApplicationError(
    "INVESTMENT_ENTITY_NOT_ACTIVE",
    "Investment account and instrument must be active"
  )
}
