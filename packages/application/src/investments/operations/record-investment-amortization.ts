import {
  bookIdFromString,
  Currency,
  InvestmentOperation,
  investmentPositionIdFromString,
  JournalEntry,
  LocalDate,
  Money,
  planInvestmentAccounting,
  Posting,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import {
  ApplicationError,
  type ApplicationErrorCode,
} from "../../ports/errors.js"
import { executeInvestmentRequest } from "../shared/execute-investment-request.js"
import type {
  AmortizationDraft,
  Clock,
  IdGenerator,
  TransactionManager,
} from "../../ports/index.js"

export class RecordInvestmentAmortization {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: AmortizationDraft) {
    return executeInvestmentRequest({
      command,
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      clock: this.clock,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null)
          throw error("ENTITY_NOT_FOUND", "Financial book was not found")
        if (command.currency !== book.baseCurrency.code)
          throw error(
            "CURRENCY_MISMATCH",
            "Investment operation must use book currency"
          )
        if (
          command.type !== "AMORTIZATION" ||
          command.cashMode !== "INTERNAL_CASH" ||
          !positive(command.bookCostReductionMinor) ||
          !nonNegative(command.grossProceedsMinor) ||
          !nonNegative(command.feesMinor) ||
          !nonNegative(command.taxesMinor) ||
          BigInt(command.grossProceedsMinor) <
            BigInt(command.feesMinor ?? "0") + BigInt(command.taxesMinor ?? "0")
        )
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "Investment amortization amounts are invalid"
          )
        const lookup = await repositories.investmentPositions.findById(
          book.id,
          investmentPositionIdFromString(command.positionId)
        )
        if (lookup.kind === "NOT_FOUND")
          throw error("ENTITY_NOT_FOUND", "Investment position was not found")
        if (lookup.kind === "BOOK_MISMATCH")
          throw error(
            "BOOK_MISMATCH",
            "Investment position does not belong to book"
          )
        const position = lookup.value
        if (position.version !== command.expectedPositionVersion)
          throw error(
            "OPTIMISTIC_CONCURRENCY_FAILURE",
            "Investment position has a conflicting version"
          )
        const before = position.toSnapshot()
        if (
          BigInt(command.bookCostReductionMinor) > BigInt(before.bookCostMinor)
        )
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "Investment cost reduction exceeds the current cost"
          )
        const account = await repositories.accounts.findById(
          before.investmentAccountId
        )
        if (account === null)
          throw error("ENTITY_NOT_FOUND", "Investment account was not found")
        const instrument = await repositories.investmentInstruments.findById(
          book.id,
          before.instrumentId
        )
        if (instrument.kind !== "FOUND")
          throw error(
            "INVESTMENT_ENTITY_NOT_ACTIVE",
            "Investment instrument must be active"
          )
        position.assertCanAllocate(
          account.status === "ACTIVE",
          instrument.value.status === "ACTIVE"
        )
        const result =
          BigInt(command.grossProceedsMinor) -
          BigInt(command.bookCostReductionMinor)
        const categories = {
          ...(result > 0n
            ? {
                gainCategoryId: await category(
                  repositories,
                  book.id,
                  command.gainCategoryId,
                  "INCOME"
                ),
              }
            : {}),
          ...(result < 0n
            ? {
                lossCategoryId: await category(
                  repositories,
                  book.id,
                  command.lossCategoryId,
                  "EXPENSE"
                ),
              }
            : {}),
          ...(BigInt(command.feesMinor ?? "0") > 0n
            ? {
                feeCategoryId: await category(
                  repositories,
                  book.id,
                  command.feeCategoryId,
                  "EXPENSE"
                ),
              }
            : {}),
          ...(BigInt(command.taxesMinor ?? "0") > 0n
            ? {
                taxCategoryId: await category(
                  repositories,
                  book.id,
                  command.taxCategoryId,
                  "EXPENSE"
                ),
              }
            : {}),
        }
        const plan = planInvestmentAccounting({
          type: "AMORTIZATION",
          capitalMinor: command.bookCostReductionMinor,
          grossAmountMinor: command.grossProceedsMinor,
          feesMinor: command.feesMinor,
          taxesMinor: command.taxesMinor,
          cashMode: "INTERNAL_CASH",
          accounts: { investmentAccountId: account.id, ...categories },
        })
        position.applyOperation({
          bookCostDeltaMinor: plan.bookCostDeltaMinor,
          occurredOn: command.occurredOn,
        })
        const journal = JournalEntry.post({
          id: this.ids.nextJournalEntryId(),
          bookId: book.id,
          occurredOn: LocalDate.parse(command.occurredOn),
          recordedAt: this.clock.now(),
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          description: command.description,
          currency: Currency.parse(book.baseCurrency.code),
          origin: "MANUAL",
          postings: plan.postings.map((posting) =>
            Posting.create({
              id: this.ids.nextPostingId(),
              accountId: posting.accountId as never,
              amount: Money.of(
                BigInt(posting.amountMinor),
                Currency.parse(book.baseCurrency.code)
              ),
            })
          ),
        })
        await repositories.journalEntries.add(journal)
        const operation = InvestmentOperation.record({
          id: this.ids.nextInvestmentOperationId(),
          bookId: book.id,
          positionId: position.id,
          type: "AMORTIZATION",
          occurredOn: command.occurredOn,
          ...(command.settledOn === undefined
            ? {}
            : { settledOn: command.settledOn }),
          recordedAt: this.clock.now(),
          sequence: await repositories.investmentSequences.next(book.id),
          description: command.description,
          currency: book.baseCurrency.code,
          bookCostDeltaMinor: plan.bookCostDeltaMinor,
          grossAmountMinor: command.grossProceedsMinor,
          feesMinor: command.feesMinor ?? "0",
          taxesMinor: command.taxesMinor ?? "0",
          netCashFlowMinor: plan.netCashFlowMinor,
          cashMode: "INTERNAL_CASH",
          categories,
          positionBefore: existingState(before),
          journalEntryId: journal.id,
        })
        await repositories.investmentPositions.save(
          position,
          command.expectedPositionVersion
        )
        await repositories.investmentOperations.add(operation)
        repositories.facts.record(position.pullDomainFacts())
        repositories.facts.record(operation.pullDomainFacts())
        repositories.facts.record(journal.pullDomainFacts())
        return {
          requestId: command.requestId,
          positionId: position.id,
          positionVersion: position.version,
          allocationRevision: position.allocationRevision,
          operationId: operation.id,
          journalEntryIds: [journal.id],
          warnings: [],
        }
      },
    })
  }
}

async function category(
  repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0],
  bookId: string,
  id: string | undefined,
  kind: "INCOME" | "EXPENSE"
) {
  const account =
    id === undefined ? null : await repositories.accounts.findById(id as never)
  if (
    account === null ||
    account.bookId !== bookId ||
    account.status !== "ACTIVE" ||
    account.kind !== kind ||
    account.systemPurpose !== undefined
  )
    throw error("INVALID_INVESTMENT_CATEGORY", "Investment category is invalid")
  return account.id
}

function existingState(
  position: ReturnType<
    import("@workspace/domain").InvestmentPosition["toSnapshot"]
  >
) {
  return {
    kind: "EXISTING" as const,
    ...(position.quantity === undefined ? {} : { quantity: position.quantity }),
    bookCostMinor: position.bookCostMinor,
    status: position.status,
    openedOn: position.openedOn,
    ...(position.closedOn === undefined ? {} : { closedOn: position.closedOn }),
    allocationEffectiveOn: position.allocationEffectiveOn,
  }
}
function error(code: ApplicationErrorCode, message: string) {
  return new ApplicationError(code, message)
}
function positive(value: string) {
  return /^\d+$/.test(value) && BigInt(value) > 0n
}
function nonNegative(value: string | undefined) {
  return value === undefined || (/^\d+$/.test(value) && BigInt(value) >= 0n)
}
