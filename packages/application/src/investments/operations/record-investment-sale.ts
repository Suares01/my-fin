import {
  bookIdFromString,
  Currency,
  Decimal,
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
  Clock,
  IdGenerator,
  SaleOrRedemptionDraft,
  TransactionManager,
} from "../../ports/index.js"

export class RecordInvestmentSale {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}
  async execute(command: SaleOrRedemptionDraft) {
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
          (command.type !== "SALE" && command.type !== "REDEMPTION") ||
          (command.destination.mode !== "INTERNAL_CASH" &&
            command.destination.mode !== "EXTERNAL_ACCOUNT") ||
          (command.destination.mode === "INTERNAL_CASH" &&
            "accountId" in command.destination) ||
          !integer(command.bookCostReductionMinor) ||
          BigInt(command.bookCostReductionMinor) < 0n ||
          !integer(command.grossProceedsMinor) ||
          BigInt(command.grossProceedsMinor) < 0n ||
          !nonNegative(command.feesMinor) ||
          !nonNegative(command.taxesMinor)
        )
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "Investment amounts are invalid"
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
        if (
          (before.quantityMode === "UNITS" &&
            !positiveDecimal(command.quantityDelta)) ||
          (before.quantityMode === "AMOUNT" &&
            command.quantityDelta !== undefined)
        )
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "Investment quantity reduction is invalid"
          )
        if (
          BigInt(command.grossProceedsMinor) <
          BigInt(command.feesMinor ?? "0") + BigInt(command.taxesMinor ?? "0")
        )
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "Investment net proceeds cannot be negative"
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
        if (
          before.quantityMode === "UNITS" &&
          command.quantityDelta === undefined
        )
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "Units positions require quantity"
          )
        const external =
          command.destination.mode === "EXTERNAL_ACCOUNT"
            ? await loadExternal(
                repositories,
                book.id,
                command.destination.accountId
              )
            : undefined
        if (external?.id === account.id)
          throw error(
            "INVALID_INVESTMENT_OPERATION",
            "External account must differ from the investment account"
          )
        const gross =
          BigInt(command.grossProceedsMinor) -
          BigInt(command.bookCostReductionMinor)
        const categories = {
          ...(gross > 0n
            ? {
                gainCategoryId: await category(
                  repositories,
                  book.id,
                  command.gainCategoryId,
                  "INCOME"
                ),
              }
            : {}),
          ...(gross < 0n
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
          type: command.type,
          capitalMinor: command.bookCostReductionMinor,
          grossAmountMinor: command.grossProceedsMinor,
          feesMinor: command.feesMinor,
          taxesMinor: command.taxesMinor,
          cashMode: command.destination.mode,
          accounts: {
            investmentAccountId: account.id,
            ...(external == null ? {} : { externalAccountId: external.id }),
            ...categories,
          },
        })
        position.applyOperation({
          ...(command.quantityDelta === undefined
            ? {}
            : { quantityDelta: `-${command.quantityDelta}` }),
          bookCostDeltaMinor: plan.bookCostDeltaMinor,
          occurredOn: command.occurredOn,
        })
        const journal =
          plan.postings.length === 0
            ? undefined
            : JournalEntry.post({
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
                postings: plan.postings.map((p) =>
                  Posting.create({
                    id: this.ids.nextPostingId(),
                    accountId: p.accountId as never,
                    amount: Money.of(
                      BigInt(p.amountMinor),
                      Currency.parse(book.baseCurrency.code)
                    ),
                  })
                ),
              })
        if (journal !== undefined)
          await repositories.journalEntries.add(journal)
        const operation = InvestmentOperation.record({
          id: this.ids.nextInvestmentOperationId(),
          bookId: book.id,
          positionId: position.id,
          type: command.type,
          occurredOn: command.occurredOn,
          ...(command.settledOn === undefined
            ? {}
            : { settledOn: command.settledOn }),
          recordedAt: this.clock.now(),
          sequence: await repositories.investmentSequences.next(book.id),
          description: command.description,
          currency: book.baseCurrency.code,
          ...(command.quantityDelta === undefined
            ? {}
            : { quantityDelta: `-${command.quantityDelta}` }),
          bookCostDeltaMinor: plan.bookCostDeltaMinor,
          grossAmountMinor: command.grossProceedsMinor,
          feesMinor: command.feesMinor ?? "0",
          taxesMinor: command.taxesMinor ?? "0",
          netCashFlowMinor: plan.netCashFlowMinor,
          cashMode: command.destination.mode,
          ...(external == null ? {} : { settlementAccountId: external.id }),
          categories,
          positionBefore: existingState(before),
          ...(journal === undefined ? {} : { journalEntryId: journal.id }),
        })
        await repositories.investmentPositions.save(
          position,
          command.expectedPositionVersion
        )
        await repositories.investmentOperations.add(operation)
        repositories.facts.record(position.pullDomainFacts())
        repositories.facts.record(operation.pullDomainFacts())
        if (journal !== undefined)
          repositories.facts.record(journal.pullDomainFacts())
        return {
          requestId: command.requestId,
          positionId: position.id,
          positionVersion: position.version,
          allocationRevision: position.allocationRevision,
          operationId: operation.id,
          journalEntryIds: journal === undefined ? [] : [journal.id],
          warnings: [],
        }
      },
    })
  }
}
async function loadExternal(
  repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0],
  bookId: string,
  id: string
) {
  const account = await repositories.accounts.findById(id as never)
  if (account === null)
    throw error("ENTITY_NOT_FOUND", "External account was not found")
  if (account.bookId !== bookId)
    throw error("BOOK_MISMATCH", "External account does not belong to book")
  if (
    account.status !== "ACTIVE" ||
    account.kind !== "ASSET" ||
    account.financialAccount === undefined
  )
    throw error(
      "INVALID_INVESTMENT_OPERATION",
      "External account must be an active financial asset"
    )
  return account
}
async function category(
  repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0],
  bookId: string,
  id: string | undefined,
  kind: "INCOME" | "EXPENSE"
) {
  const a =
    id === undefined ? null : await repositories.accounts.findById(id as never)
  if (
    a === null ||
    a.bookId !== bookId ||
    a.status !== "ACTIVE" ||
    a.kind !== kind ||
    a.systemPurpose !== undefined
  )
    throw error("INVALID_INVESTMENT_CATEGORY", "Investment category is invalid")
  return a.id
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
function integer(v: string) {
  return /^-?\d+$/.test(v)
}
function nonNegative(v: string | undefined) {
  return v === undefined || (/^\d+$/.test(v) && BigInt(v) >= 0n)
}
function positiveDecimal(v: string | undefined) {
  if (v === undefined) return false
  try {
    return Decimal.parse(v).compare(Decimal.parse("0")) > 0
  } catch {
    return false
  }
}
