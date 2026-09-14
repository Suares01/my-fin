import {
  bookIdFromString,
  Currency,
  type FinancialBook,
  InvestmentOperation,
  investmentPositionIdFromString,
  JournalEntry,
  LocalDate,
  Money,
  planInvestmentAccounting,
  Posting,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { ApplicationError } from "../../ports/errors.js"
import { executeInvestmentRequest } from "../shared/execute-investment-request.js"
import type {
  Clock,
  IdGenerator,
  PurchaseOrApplicationDraft,
  TransactionManager,
} from "../../ports/index.js"

export class RecordInvestmentPurchase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: PurchaseOrApplicationDraft) {
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
        if (command.currency !== book.baseCurrency.code)
          throw new ApplicationError(
            "CURRENCY_MISMATCH",
            "Investment operation must use the book currency"
          )
        if (
          command.funding.mode !== "INTERNAL_CASH" &&
          command.funding.mode !== "EXTERNAL_ACCOUNT"
        )
          throw invalid("Investment funding route must be explicit")
        if (
          !positive(command.capitalMinor) ||
          !nonNegative(command.feesMinor) ||
          !nonNegative(command.taxesMinor)
        )
          throw invalid("Investment amounts are invalid")
        const lookup = await repositories.investmentPositions.findById(
          book.id,
          investmentPositionIdFromString(command.positionId)
        )
        if (lookup.kind === "NOT_FOUND")
          throw notFound("Investment position", command.positionId)
        if (lookup.kind === "BOOK_MISMATCH")
          throw mismatch("Investment position")
        const position = lookup.value
        if (position.version !== command.expectedPositionVersion)
          throw concurrency()
        const before = position.toSnapshot()
        const account = await repositories.accounts.findById(
          before.investmentAccountId
        )
        if (account === null)
          throw notFound("Investment account", before.investmentAccountId)
        const instrument = await repositories.investmentInstruments.findById(
          book.id,
          before.instrumentId
        )
        if (instrument.kind !== "FOUND")
          throw new ApplicationError(
            "INVESTMENT_ENTITY_NOT_ACTIVE",
            "Investment instrument must be active"
          )
        position.assertCanAllocate(
          account.status === "ACTIVE",
          instrument.value.status === "ACTIVE"
        )

        const external =
          command.funding.mode === "EXTERNAL_ACCOUNT"
            ? await loadExternal(
                repositories,
                book.id,
                command.funding.accountId
              )
            : undefined
        if (external?.id === account.id)
          throw new ApplicationError(
            "INVALID_INVESTMENT_OPERATION",
            "External account must differ from the investment account"
          )
        if (
          before.quantityMode === "UNITS" &&
          command.quantityDelta === undefined
        )
          throw new ApplicationError(
            "INVALID_INVESTMENT_OPERATION",
            "Units positions require an explicit quantity delta"
          )
        const categories = await loadExpenseCategories(
          repositories,
          book.id,
          command
        )
        const plan = planInvestmentAccounting({
          type: command.type,
          capitalMinor: command.capitalMinor,
          grossAmountMinor: "0",
          feesMinor: command.feesMinor,
          taxesMinor: command.taxesMinor,
          cashMode: command.funding.mode,
          accounts: {
            investmentAccountId: account.id,
            ...(external === undefined
              ? {}
              : { externalAccountId: external.id }),
            ...categories,
          },
        })
        position.applyOperation({
          ...(command.quantityDelta === undefined
            ? {}
            : { quantityDelta: command.quantityDelta }),
          bookCostDeltaMinor: plan.bookCostDeltaMinor,
          occurredOn: command.occurredOn,
        })
        const journal = await postPlan({
          repositories,
          book,
          plan,
          command,
          ids: this.ids,
          clock: this.clock,
        })
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
            : { quantityDelta: command.quantityDelta }),
          bookCostDeltaMinor: plan.bookCostDeltaMinor,
          grossAmountMinor: "0",
          feesMinor: command.feesMinor ?? "0",
          taxesMinor: command.taxesMinor ?? "0",
          netCashFlowMinor: plan.netCashFlowMinor,
          cashMode: command.funding.mode,
          ...(external === undefined
            ? {}
            : { settlementAccountId: external.id }),
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
          journalEntryIds: journal === undefined ? [] : [journal.id],
          warnings: cash
            .filter((value) => BigInt(value.cashMinor) < 0n)
            .map((value) => ({
              code: "INVESTMENT_CASH_NEGATIVE" as const,
              investmentAccountId: value.investmentAccountId,
              cashMinor: value.cashMinor,
              currency: value.currency,
              asOf: command.occurredOn,
            })),
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
  if (account === null) throw notFound("External account", id)
  if (account.bookId !== bookId) throw mismatch("External account")
  if (
    account.status !== "ACTIVE" ||
    account.kind !== "ASSET" ||
    account.financialAccount === undefined
  )
    throw new ApplicationError(
      "INVALID_INVESTMENT_OPERATION",
      "External account must be an active financial asset"
    )
  return account
}

async function loadExpenseCategories(
  repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0],
  bookId: string,
  command: PurchaseOrApplicationDraft
) {
  return {
    ...(BigInt(command.feesMinor ?? "0") === 0n
      ? {}
      : {
          feeCategoryId: await category(
            repositories,
            bookId,
            command.feeCategoryId,
            "EXPENSE"
          ),
        }),
    ...(BigInt(command.taxesMinor ?? "0") === 0n
      ? {}
      : {
          taxCategoryId: await category(
            repositories,
            bookId,
            command.taxCategoryId,
            "EXPENSE"
          ),
        }),
  }
}

async function category(
  repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0],
  bookId: string,
  id: string | undefined,
  kind: "EXPENSE"
) {
  if (id === undefined)
    throw new ApplicationError(
      "INVALID_INVESTMENT_CATEGORY",
      "Investment expense category is required"
    )
  const account = await repositories.accounts.findById(id as never)
  if (
    account === null ||
    account.bookId !== bookId ||
    account.status !== "ACTIVE" ||
    account.kind !== kind ||
    account.systemPurpose !== undefined
  )
    throw new ApplicationError(
      "INVALID_INVESTMENT_CATEGORY",
      "Investment category is invalid"
    )
  return account.id
}

async function postPlan(input: {
  readonly repositories: Parameters<
    Parameters<typeof executeInvestmentRequest>[0]["work"]
  >[0]
  readonly book: FinancialBook
  readonly plan: ReturnType<typeof planInvestmentAccounting>
  readonly command: PurchaseOrApplicationDraft
  readonly ids: IdGenerator
  readonly clock: Clock
}) {
  if (input.plan.postings.length === 0) return undefined
  const entry = JournalEntry.post({
    id: input.ids.nextJournalEntryId(),
    bookId: input.book.id,
    occurredOn: LocalDate.parse(input.command.occurredOn),
    recordedAt: input.clock.now(),
    sequence: await input.repositories.journalEntries.reserveNextSequence(
      input.book.id
    ),
    description: input.command.description,
    currency: Currency.parse(input.book.baseCurrency.code),
    origin: "MANUAL",
    postings: input.plan.postings.map((posting) =>
      Posting.create({
        id: input.ids.nextPostingId(),
        accountId: posting.accountId as never,
        amount: Money.of(
          BigInt(posting.amountMinor),
          Currency.parse(input.book.baseCurrency.code)
        ),
      })
    ),
  })
  await input.repositories.journalEntries.add(entry)
  return entry
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
function notFound(entity: string, id: string) {
  return new ApplicationError(
    "ENTITY_NOT_FOUND",
    `${entity} ${id} was not found`
  )
}
function mismatch(entity: string) {
  return new ApplicationError(
    "BOOK_MISMATCH",
    `${entity} does not belong to the requested book`
  )
}
function concurrency() {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    "Investment position has a conflicting version"
  )
}
function invalid(message: string) {
  return new ApplicationError("INVALID_INVESTMENT_OPERATION", message)
}
function nonNegative(value: string | undefined) {
  return value === undefined || (/^\d+$/.test(value) && BigInt(value) >= 0n)
}
function positive(value: string) {
  return /^\d+$/.test(value) && BigInt(value) > 0n
}
