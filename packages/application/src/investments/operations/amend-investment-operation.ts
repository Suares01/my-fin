import {
  bookIdFromString,
  Currency,
  Decimal,
  InvestmentOperation,
  type InvestmentPosition,
  investmentOperationIdFromString,
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
  AmendInvestmentOperationCommand,
  Clock,
  IdGenerator,
  InvestmentOperationDraft,
  RepositoryContext,
  TransactionManager,
} from "../../ports/index.js"

/** Replaces the last effective investment operation without deleting its audit trail. */
export class AmendInvestmentOperation {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: AmendInvestmentOperationCommand) {
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
        const originalSnapshot = original.toSnapshot()
        if (original.version !== command.expectedOperationVersion)
          throw concurrent("Investment operation")
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
        assertReplacementShape(
          command.replacement,
          originalSnapshot,
          book.id,
          this.clock.localDate(book.timezone)
        )
        const previous =
          await repositories.investmentOperations.findLastEffective(
            book.id,
            position.id,
            original.id
          )
        if (
          previous !== null &&
          command.replacement.occurredOn < previous.toSnapshot().occurredOn
        )
          throw invalid(
            "Replacement date precedes the prior effective operation"
          )

        const account = await repositories.accounts.findById(
          position.toSnapshot().investmentAccountId
        )
        const instrument = await repositories.investmentInstruments.findById(
          book.id,
          position.toSnapshot().instrumentId
        )
        if (account === null) throw missing("Investment account")
        if (instrument.kind !== "FOUND") throw inactive()
        if (
          command.replacement.type === "INCOME" ||
          command.replacement.type === "FEE" ||
          command.replacement.type === "TAX"
        )
          position.assertCanRecordPostClosureCashFlow(
            account.status === "ACTIVE",
            instrument.value.status === "ACTIVE"
          )
        else
          position.assertCanAllocate(
            account.status === "ACTIVE",
            instrument.value.status === "ACTIVE"
          )
        const replacement = await createReplacement({
          repositories,
          book,
          position,
          accountId: account.id,
          draft: command.replacement,
          original: originalSnapshot,
          ids: this.ids,
          clock: this.clock,
        })

        let originalJournal: JournalEntry | undefined
        if (originalSnapshot.journalEntryId !== undefined) {
          const found = await repositories.journalEntries.findById(
            originalSnapshot.journalEntryId
          )
          if (found === null) throw missing("Investment journal entry")
          originalJournal = found
        }
        if (originalJournal !== undefined && originalJournal.bookId !== book.id)
          throw mismatch("Investment journal entry")
        const reversalJournal =
          originalJournal === undefined
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
        const reversal = InvestmentOperation.createReversal({
          id: this.ids.nextInvestmentOperationId(),
          original: originalSnapshot,
          recordedAt: this.clock.now(),
          sequence: await repositories.investmentSequences.next(book.id),
          ...(reversalJournal === undefined
            ? {}
            : { journalEntryId: reversalJournal.id }),
        })

        position.replaceOperation({
          state: originalSnapshot.positionBefore,
          effect: {
            ...(replacement.quantityDelta === undefined
              ? {}
              : { quantityDelta: replacement.quantityDelta }),
            bookCostDeltaMinor: replacement.plan.bookCostDeltaMinor,
            occurredOn: command.replacement.occurredOn,
          },
        })
        const replacementOperation = InvestmentOperation.record({
          id: this.ids.nextInvestmentOperationId(),
          bookId: book.id,
          positionId: position.id,
          type: command.replacement.type,
          occurredOn: command.replacement.occurredOn,
          ...(command.replacement.settledOn === undefined
            ? {}
            : { settledOn: command.replacement.settledOn }),
          recordedAt: this.clock.now(),
          sequence: await repositories.investmentSequences.next(book.id),
          description: command.replacement.description,
          currency: book.baseCurrency.code,
          ...(replacement.quantityDelta === undefined
            ? {}
            : { quantityDelta: replacement.quantityDelta }),
          bookCostDeltaMinor: replacement.plan.bookCostDeltaMinor,
          grossAmountMinor: replacement.grossAmountMinor,
          feesMinor: replacement.feesMinor,
          taxesMinor: replacement.taxesMinor,
          netCashFlowMinor: replacement.plan.netCashFlowMinor,
          cashMode: replacement.cashMode,
          ...(replacement.settlementAccountId === undefined
            ? {}
            : { settlementAccountId: replacement.settlementAccountId }),
          categories: replacement.categories,
          positionBefore: originalSnapshot.positionBefore,
          replacementOf: original.id,
          ...(replacement.journal === undefined
            ? {}
            : { journalEntryId: replacement.journal.id }),
        })

        if (reversalJournal !== undefined && originalJournal !== undefined) {
          if (replacement.journal !== undefined)
            originalJournal.markAmendedBy(
              reversalJournal.id,
              replacement.journal.id
            )
          else originalJournal.markReversedBy(reversalJournal.id)
          await repositories.journalEntries.add(reversalJournal)
          await repositories.journalEntries.save(
            originalJournal,
            originalJournal.version - 1
          )
        }
        if (replacement.journal !== undefined)
          await repositories.journalEntries.add(replacement.journal)
        await repositories.investmentOperations.add(reversal)
        await repositories.investmentOperations.add(replacementOperation)
        original.markReplacedBy(replacementOperation.id)
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
        repositories.facts.record(reversal.pullDomainFacts())
        repositories.facts.record(replacementOperation.pullDomainFacts())
        if (reversalJournal !== undefined)
          repositories.facts.record(reversalJournal.pullDomainFacts())
        if (replacement.journal !== undefined)
          repositories.facts.record(replacement.journal.pullDomainFacts())
        const cash = await repositories.investmentReads.accountCash(
          book.id,
          [account.id],
          command.replacement.occurredOn
        )
        return {
          requestId: command.requestId,
          positionId: position.id,
          positionVersion: position.version,
          allocationRevision: position.allocationRevision,
          operationId: original.id,
          reversalOperationId: reversal.id,
          replacementOperationId: replacementOperation.id,
          journalEntryIds: [reversalJournal, replacement.journal].flatMap(
            (entry) => (entry === undefined ? [] : [entry.id])
          ),
          warnings: cash
            .filter((value) => BigInt(value.cashMinor) < 0n)
            .map((value) => ({
              code: "INVESTMENT_CASH_NEGATIVE" as const,
              investmentAccountId: value.investmentAccountId,
              cashMinor: value.cashMinor,
              currency: value.currency,
              asOf: command.replacement.occurredOn,
            })),
        }
      },
    })
  }
}

async function createReplacement(input: {
  readonly repositories: RepositoryContext
  readonly book: NonNullable<
    Awaited<ReturnType<RepositoryContext["books"]["findById"]>>
  >
  readonly position: InvestmentPosition
  readonly accountId: string
  readonly draft: InvestmentOperationDraft
  readonly original: ReturnType<InvestmentOperation["toSnapshot"]>
  readonly ids: IdGenerator
  readonly clock: Clock
}) {
  const { draft, repositories, book } = input
  const amounts = draftAmounts(draft)
  const categories = await loadCategories(
    repositories,
    book.id,
    draft,
    amounts.resultMinor
  )
  const external =
    "funding" in draft && draft.funding.mode === "EXTERNAL_ACCOUNT"
      ? await externalAccount(repositories, book.id, draft.funding.accountId)
      : "destination" in draft && draft.destination.mode === "EXTERNAL_ACCOUNT"
        ? await externalAccount(
            repositories,
            book.id,
            draft.destination.accountId
          )
        : undefined
  if (external?.id === input.accountId)
    throw invalid("External account must differ from the investment account")
  const cashMode =
    "funding" in draft
      ? draft.funding.mode
      : "destination" in draft
        ? draft.destination.mode
        : draft.cashMode
  const plan = planInvestmentAccounting({
    type: draft.type,
    capitalMinor: amounts.capitalMinor,
    grossAmountMinor: amounts.grossAmountMinor,
    feesMinor: amounts.feesMinor,
    taxesMinor: amounts.taxesMinor,
    cashMode,
    accounts: {
      investmentAccountId: input.accountId,
      ...(external === undefined ? {} : { externalAccountId: external.id }),
      ...categories,
    },
  })
  const originalJournal = input.original.journalEntryId
  const journal =
    plan.postings.length === 0
      ? undefined
      : JournalEntry.post({
          id: input.ids.nextJournalEntryId(),
          bookId: book.id,
          occurredOn: LocalDate.parse(draft.occurredOn),
          recordedAt: input.clock.now(),
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          description: draft.description,
          currency: Currency.parse(book.baseCurrency.code),
          origin: "MANUAL",
          ...(originalJournal === undefined
            ? {}
            : { replacementOf: originalJournal }),
          postings: plan.postings.map((posting) =>
            Posting.create({
              id: input.ids.nextPostingId(),
              accountId: posting.accountId as never,
              amount: Money.of(
                BigInt(posting.amountMinor),
                Currency.parse(book.baseCurrency.code)
              ),
            })
          ),
        })
  return {
    plan,
    journal,
    categories,
    cashMode,
    settlementAccountId: external?.id,
    quantityDelta: quantityDelta(draft),
    ...amounts,
  }
}

function assertReplacementShape(
  draft: InvestmentOperationDraft,
  original: ReturnType<InvestmentOperation["toSnapshot"]>,
  bookId: string,
  today: string
) {
  if (
    draft.bookId !== bookId ||
    draft.positionId !== original.positionId ||
    draft.type !== original.type
  )
    throw invalid("Replacement must retain book, position and operation type")
  try {
    LocalDate.parse(draft.occurredOn)
  } catch {
    throw invalid("Replacement date or currency is invalid")
  }
  if (draft.currency !== original.currency || draft.occurredOn > today)
    throw invalid("Replacement date or currency is invalid")
}
function draftAmounts(draft: InvestmentOperationDraft) {
  if (draft.type === "PURCHASE" || draft.type === "APPLICATION")
    return {
      capitalMinor: integer(draft.capitalMinor, true),
      grossAmountMinor: "0",
      feesMinor: optionalInteger(draft.feesMinor),
      taxesMinor: optionalInteger(draft.taxesMinor),
      resultMinor: 0n,
      grossAmountMinorForRecord: "0",
    }
  if (
    draft.type === "SALE" ||
    draft.type === "REDEMPTION" ||
    draft.type === "AMORTIZATION"
  ) {
    const capitalMinor = integer(
      draft.bookCostReductionMinor,
      draft.type === "AMORTIZATION"
    )
    const grossAmountMinor = integer(draft.grossProceedsMinor, false)
    const feesMinor = optionalInteger(draft.feesMinor)
    const taxesMinor = optionalInteger(draft.taxesMinor)
    if (BigInt(grossAmountMinor) < BigInt(feesMinor) + BigInt(taxesMinor))
      throw invalid("Investment net proceeds cannot be negative")
    return {
      capitalMinor,
      grossAmountMinor,
      feesMinor,
      taxesMinor,
      resultMinor: BigInt(grossAmountMinor) - BigInt(capitalMinor),
      grossAmountMinorForRecord: grossAmountMinor,
    }
  }
  if (draft.type === "INCOME") {
    const grossAmountMinor = integer(draft.grossAmountMinor, true)
    const feesMinor = optionalInteger(draft.feesMinor)
    const taxesMinor = optionalInteger(draft.taxesMinor)
    if (BigInt(grossAmountMinor) < BigInt(feesMinor) + BigInt(taxesMinor))
      throw invalid("Investment income amounts are invalid")
    return {
      capitalMinor: "0",
      grossAmountMinor,
      feesMinor,
      taxesMinor,
      resultMinor: 0n,
      grossAmountMinorForRecord: grossAmountMinor,
    }
  }
  const expense = draft as Extract<
    InvestmentOperationDraft,
    { type: "FEE" | "TAX" }
  >
  const amount = integer(expense.amountMinor, true)
  return {
    capitalMinor: "0",
    grossAmountMinor: "0",
    feesMinor: draft.type === "FEE" ? amount : "0",
    taxesMinor: draft.type === "TAX" ? amount : "0",
    resultMinor: 0n,
    grossAmountMinorForRecord: "0",
  }
}
function quantityDelta(draft: InvestmentOperationDraft) {
  if (draft.type === "PURCHASE" || draft.type === "APPLICATION")
    return draft.quantityDelta
  if (draft.type === "SALE" || draft.type === "REDEMPTION") {
    if (draft.quantityDelta === undefined) return undefined
    try {
      if (Decimal.parse(draft.quantityDelta).compare(Decimal.parse("0")) <= 0)
        throw invalid("Investment quantity reduction is invalid")
    } catch {
      throw invalid("Investment quantity reduction is invalid")
    }
    return `-${draft.quantityDelta}`
  }
  return undefined
}
async function loadCategories(
  repositories: RepositoryContext,
  bookId: string,
  draft: InvestmentOperationDraft,
  resultMinor: bigint
) {
  const category = async (
    id: string | undefined,
    kind: "INCOME" | "EXPENSE"
  ) => {
    const value =
      id === undefined
        ? null
        : await repositories.accounts.findById(id as never)
    if (
      value === null ||
      value.bookId !== bookId ||
      value.status !== "ACTIVE" ||
      value.kind !== kind ||
      value.systemPurpose !== undefined
    )
      throw new ApplicationError(
        "INVALID_INVESTMENT_CATEGORY",
        "Investment category is invalid"
      )
    return value.id
  }
  if (draft.type === "FEE" || draft.type === "TAX")
    return draft.type === "FEE"
      ? { feeCategoryId: await category(draft.expenseCategoryId, "EXPENSE") }
      : { taxCategoryId: await category(draft.expenseCategoryId, "EXPENSE") }
  const categorized = draft as Exclude<
    InvestmentOperationDraft,
    Extract<InvestmentOperationDraft, { type: "FEE" | "TAX" }>
  >
  const fees =
    "feesMinor" in categorized ? BigInt(categorized.feesMinor ?? "0") : 0n
  const taxes =
    "taxesMinor" in categorized ? BigInt(categorized.taxesMinor ?? "0") : 0n
  return {
    ...((draft.type === "SALE" ||
      draft.type === "REDEMPTION" ||
      draft.type === "AMORTIZATION") &&
    resultMinor > 0n
      ? { gainCategoryId: await category(draft.gainCategoryId, "INCOME") }
      : {}),
    ...((draft.type === "SALE" ||
      draft.type === "REDEMPTION" ||
      draft.type === "AMORTIZATION") &&
    resultMinor < 0n
      ? { lossCategoryId: await category(draft.lossCategoryId, "EXPENSE") }
      : {}),
    ...(draft.type === "INCOME"
      ? { incomeCategoryId: await category(draft.incomeCategoryId, "INCOME") }
      : {}),
    ...(fees > 0n
      ? { feeCategoryId: await category(categorized.feeCategoryId, "EXPENSE") }
      : {}),
    ...(taxes > 0n
      ? { taxCategoryId: await category(categorized.taxCategoryId, "EXPENSE") }
      : {}),
  }
}
async function externalAccount(
  repositories: RepositoryContext,
  bookId: string,
  id: string
) {
  const account = await repositories.accounts.findById(id as never)
  if (account === null) throw missing("External account")
  if (account.bookId !== bookId) throw mismatch("External account")
  if (
    account.status !== "ACTIVE" ||
    account.kind !== "ASSET" ||
    account.financialAccount === undefined
  )
    throw invalid("External account must be an active financial asset")
  return account
}
function integer(value: string, strictlyPositive: boolean) {
  if (!/^\d+$/.test(value) || (strictlyPositive && BigInt(value) <= 0n))
    throw invalid("Investment amounts are invalid")
  return value
}
function optionalInteger(value: string | undefined) {
  return value === undefined ? "0" : integer(value, false)
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
function inactive() {
  return new ApplicationError(
    "INVESTMENT_ENTITY_NOT_ACTIVE",
    "Investment instrument must be active"
  )
}
function invalid(message: string) {
  return new ApplicationError("INVALID_INVESTMENT_OPERATION", message)
}
