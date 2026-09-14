import {
  bookIdFromString,
  Decimal,
  InvestmentPosition,
  investmentPositionIdFromString,
  planInvestmentAccounting,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import type {
  InvestmentOperationDraft,
  InvestmentOperationPreview,
  PreviewInvestmentOperationCommand,
  RepositoryContext,
  TransactionManager,
} from "../../ports/index.js"

/** Calculates an operation from the current transactional state without reserving a write resource. */
export class PreviewInvestmentOperation {
  constructor(private readonly transactionManager: TransactionManager) {}

  async execute(
    command: PreviewInvestmentOperationCommand
  ): Promise<ResultType<InvestmentOperationPreview, ApplicationError>> {
    try {
      const transaction = await this.transactionManager.execute(
        async (repositories) => {
          const book = await repositories.books.findById(
            bookIdFromString(command.bookId)
          )
          if (book === null) throw missing("Financial book")
          if (command.draft.bookId !== book.id)
            throw mismatch("Investment draft")
          if (command.draft.currency !== book.baseCurrency.code)
            throw new ApplicationError(
              "CURRENCY_MISMATCH",
              "Investment operation must use book currency"
            )

          const lookup = await repositories.investmentPositions.findById(
            book.id,
            investmentPositionIdFromString(command.draft.positionId)
          )
          if (lookup.kind === "NOT_FOUND") throw missing("Investment position")
          if (lookup.kind === "BOOK_MISMATCH")
            throw mismatch("Investment position")
          const position = lookup.value
          if (position.version !== command.draft.expectedPositionVersion)
            throw concurrent()
          const snapshot = position.toSnapshot()

          const account = await repositories.accounts.findById(
            snapshot.investmentAccountId
          )
          if (account === null) throw missing("Investment account")
          const instrument = await repositories.investmentInstruments.findById(
            book.id,
            snapshot.instrumentId
          )
          if (instrument.kind !== "FOUND")
            throw new ApplicationError(
              "INVESTMENT_ENTITY_NOT_ACTIVE",
              "Investment instrument must be active"
            )

          if (changesAllocation(command.draft))
            position.assertCanAllocate(
              account.status === "ACTIVE",
              instrument.value.status === "ACTIVE"
            )
          else
            position.assertCanRecordPostClosureCashFlow(
              account.status === "ACTIVE",
              instrument.value.status === "ACTIVE"
            )

          validateDraft(command.draft, snapshot)
          const categories = await categoriesFor(
            repositories,
            book.id,
            command.draft
          )
          const externalAccountId = await externalAccountFor(
            repositories,
            book.id,
            snapshot.investmentAccountId,
            command.draft
          )
          const plan = planInvestmentAccounting(
            planInput(
              command.draft,
              snapshot.investmentAccountId,
              externalAccountId,
              categories
            )
          )

          InvestmentPosition.restore(snapshot).applyOperation({
            ...(quantityDelta(command.draft) === undefined
              ? {}
              : { quantityDelta: quantityDelta(command.draft) }),
            bookCostDeltaMinor: plan.bookCostDeltaMinor,
            occurredOn: command.draft.occurredOn,
          })

          const cash = await repositories.investmentReads.accountCash(
            book.id,
            [snapshot.investmentAccountId],
            command.draft.occurredOn
          )
          const current = cash[0]
          if (current === undefined)
            throw new ApplicationError(
              "UNEXPECTED_ERROR",
              "Investment cash state was not returned"
            )
          const investmentPostingDelta = plan.postings
            .filter(
              (posting) => posting.accountId === snapshot.investmentAccountId
            )
            .reduce((sum, posting) => sum + BigInt(posting.amountMinor), 0n)
          const projectedCashMinor = (
            BigInt(current.cashMinor) +
            investmentPostingDelta -
            BigInt(plan.bookCostDeltaMinor)
          ).toString()

          return {
            positionId: position.id,
            positionVersion: position.version,
            allocationRevision: position.allocationRevision,
            bookCostDeltaMinor: plan.bookCostDeltaMinor,
            netCashFlowMinor: plan.netCashFlowMinor,
            postings: plan.postings,
            categories,
            projectedCashMinor,
            warnings:
              BigInt(projectedCashMinor) < 0n
                ? [
                    {
                      code: "INVESTMENT_CASH_NEGATIVE" as const,
                      investmentAccountId: snapshot.investmentAccountId,
                      cashMinor: projectedCashMinor,
                      currency: current.currency,
                      asOf: command.draft.occurredOn,
                    },
                  ]
                : [],
          } satisfies InvestmentOperationPreview
        }
      )
      return Result.ok(transaction.value)
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}

async function externalAccountFor(
  repositories: RepositoryContext,
  bookId: string,
  investmentAccountId: string,
  draft: InvestmentOperationDraft
) {
  const route =
    "funding" in draft
      ? draft.funding
      : "destination" in draft
        ? draft.destination
        : undefined
  if (route === undefined || route.mode === "INTERNAL_CASH") return undefined
  if (route.mode !== "EXTERNAL_ACCOUNT")
    throw invalid("Investment cash route must be explicit")
  const account = await repositories.accounts.findById(route.accountId as never)
  if (account === null) throw missing("External account")
  if (account.bookId !== bookId) throw mismatch("External account")
  if (
    account.id === investmentAccountId ||
    account.status !== "ACTIVE" ||
    account.kind !== "ASSET" ||
    account.financialAccount === undefined
  )
    throw invalid("External account must be an active financial asset")
  return account.id
}

async function categoriesFor(
  repositories: RepositoryContext,
  bookId: string,
  draft: InvestmentOperationDraft
) {
  const categories: Record<string, string> = {}
  const add = async (
    key:
      | "gainCategoryId"
      | "lossCategoryId"
      | "incomeCategoryId"
      | "feeCategoryId"
      | "taxCategoryId",
    id: string | undefined,
    kind: "INCOME" | "EXPENSE"
  ) => {
    if (id === undefined) throw invalid("Investment category is required")
    const account = await repositories.accounts.findById(id as never)
    if (
      account === null ||
      account.bookId !== bookId ||
      account.status !== "ACTIVE" ||
      account.kind !== kind ||
      account.systemPurpose !== undefined
    )
      throw invalidCategory()
    categories[key] = account.id
  }
  const fees = amount(draft, "feesMinor")
  const taxes = amount(draft, "taxesMinor")
  if (draft.type === "FEE")
    await add("feeCategoryId", draft.expenseCategoryId, "EXPENSE")
  if (draft.type === "TAX")
    await add("taxCategoryId", draft.expenseCategoryId, "EXPENSE")
  if (draft.type === "INCOME")
    await add("incomeCategoryId", draft.incomeCategoryId, "INCOME")
  if (
    draft.type === "SALE" ||
    draft.type === "REDEMPTION" ||
    draft.type === "AMORTIZATION"
  ) {
    const result =
      BigInt(draft.grossProceedsMinor) - BigInt(draft.bookCostReductionMinor)
    if (result > 0n) await add("gainCategoryId", draft.gainCategoryId, "INCOME")
    if (result < 0n)
      await add("lossCategoryId", draft.lossCategoryId, "EXPENSE")
  }
  if (
    fees > 0n &&
    (draft.type === "PURCHASE" ||
      draft.type === "APPLICATION" ||
      draft.type === "SALE" ||
      draft.type === "REDEMPTION" ||
      draft.type === "INCOME" ||
      draft.type === "AMORTIZATION")
  )
    await add("feeCategoryId", draft.feeCategoryId, "EXPENSE")
  if (
    taxes > 0n &&
    (draft.type === "PURCHASE" ||
      draft.type === "APPLICATION" ||
      draft.type === "SALE" ||
      draft.type === "REDEMPTION" ||
      draft.type === "INCOME" ||
      draft.type === "AMORTIZATION")
  )
    await add("taxCategoryId", draft.taxCategoryId, "EXPENSE")
  return categories
}

function validateDraft(
  draft: InvestmentOperationDraft,
  position: ReturnType<InvestmentPosition["toSnapshot"]>
) {
  const fees = amount(draft, "feesMinor")
  const taxes = amount(draft, "taxesMinor")
  const expenses = fees + taxes
  if (!optionalAmountsAreValid(draft))
    throw invalid("Investment expenses are invalid")
  if (draft.type === "PURCHASE" || draft.type === "APPLICATION") {
    if (
      !positiveInteger(draft.capitalMinor) ||
      (draft.funding.mode !== "INTERNAL_CASH" &&
        draft.funding.mode !== "EXTERNAL_ACCOUNT")
    )
      throw invalid("Investment capital is invalid")
    if (
      position.quantityMode === "UNITS" &&
      !positiveDecimal(draft.quantityDelta)
    )
      throw invalid("Units positions require an explicit quantity delta")
    return
  }
  if (draft.type === "SALE" || draft.type === "REDEMPTION") {
    if (
      !nonNegativeInteger(draft.bookCostReductionMinor) ||
      !nonNegativeInteger(draft.grossProceedsMinor) ||
      (draft.destination.mode !== "INTERNAL_CASH" &&
        draft.destination.mode !== "EXTERNAL_ACCOUNT") ||
      BigInt(draft.bookCostReductionMinor) > BigInt(position.bookCostMinor) ||
      BigInt(draft.grossProceedsMinor) < expenses ||
      (position.quantityMode === "UNITS" &&
        !positiveDecimal(draft.quantityDelta)) ||
      (position.quantityMode === "AMOUNT" && draft.quantityDelta !== undefined)
    )
      throw invalid("Investment sale is invalid")
    return
  }
  if (draft.type === "INCOME") {
    if (
      draft.cashMode !== "INTERNAL_CASH" ||
      !positiveInteger(draft.grossAmountMinor) ||
      BigInt(draft.grossAmountMinor) < expenses
    )
      throw invalid("Investment income is invalid")
    return
  }
  if (draft.type === "AMORTIZATION") {
    if (
      draft.cashMode !== "INTERNAL_CASH" ||
      !positiveInteger(draft.bookCostReductionMinor) ||
      !nonNegativeInteger(draft.grossProceedsMinor) ||
      BigInt(draft.bookCostReductionMinor) > BigInt(position.bookCostMinor) ||
      BigInt(draft.grossProceedsMinor) < expenses
    )
      throw invalid("Investment amortization is invalid")
    return
  }
  if (
    (draft.type !== "FEE" && draft.type !== "TAX") ||
    draft.cashMode !== "INTERNAL_CASH" ||
    !positiveInteger(draft.amountMinor)
  )
    throw invalid("Investment expense is invalid")
}

function planInput(
  draft: InvestmentOperationDraft,
  investmentAccountId: string,
  externalAccountId: string | undefined,
  categories: Record<string, string>
) {
  return {
    type: draft.type,
    capitalMinor:
      "capitalMinor" in draft
        ? draft.capitalMinor
        : "bookCostReductionMinor" in draft
          ? draft.bookCostReductionMinor
          : "0",
    grossAmountMinor:
      "grossProceedsMinor" in draft
        ? draft.grossProceedsMinor
        : "grossAmountMinor" in draft
          ? draft.grossAmountMinor
          : "0",
    feesMinor:
      "feesMinor" in draft
        ? draft.feesMinor
        : draft.type === "FEE"
          ? draft.amountMinor
          : undefined,
    taxesMinor:
      "taxesMinor" in draft
        ? draft.taxesMinor
        : draft.type === "TAX"
          ? draft.amountMinor
          : undefined,
    cashMode:
      "funding" in draft
        ? draft.funding.mode
        : "destination" in draft
          ? draft.destination.mode
          : draft.cashMode,
    accounts: { investmentAccountId, externalAccountId, ...categories },
  }
}

function quantityDelta(draft: InvestmentOperationDraft) {
  if (draft.type === "PURCHASE" || draft.type === "APPLICATION")
    return draft.quantityDelta
  if (draft.type === "SALE" || draft.type === "REDEMPTION")
    return draft.quantityDelta === undefined
      ? undefined
      : `-${draft.quantityDelta}`
  return undefined
}

function changesAllocation(draft: InvestmentOperationDraft) {
  return draft.type !== "INCOME" && draft.type !== "FEE" && draft.type !== "TAX"
}

function amount(
  draft: InvestmentOperationDraft,
  field: "feesMinor" | "taxesMinor"
) {
  const value = (draft as Partial<Record<typeof field, string>>)[field]
  return value === undefined || !nonNegativeInteger(value) ? 0n : BigInt(value)
}

function optionalAmountsAreValid(draft: InvestmentOperationDraft) {
  return (
    (!("feesMinor" in draft) ||
      draft.feesMinor === undefined ||
      nonNegativeInteger(draft.feesMinor)) &&
    (!("taxesMinor" in draft) ||
      draft.taxesMinor === undefined ||
      nonNegativeInteger(draft.taxesMinor))
  )
}

function positiveInteger(value: string) {
  return /^\d+$/.test(value) && BigInt(value) > 0n
}

function nonNegativeInteger(value: string | undefined) {
  return value !== undefined && /^\d+$/.test(value)
}

function positiveDecimal(value: string | undefined) {
  if (value === undefined) return false
  try {
    return Decimal.parse(value).compare(Decimal.parse("0")) > 0
  } catch {
    return false
  }
}

function missing(entity: string) {
  return new ApplicationError("ENTITY_NOT_FOUND", `${entity} was not found`)
}
function mismatch(entity: string) {
  return new ApplicationError(
    "BOOK_MISMATCH",
    `${entity} does not belong to the requested book`
  )
}
function concurrent() {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    "Investment position has a conflicting version"
  )
}
function invalid(message: string) {
  return new ApplicationError("INVALID_INVESTMENT_OPERATION", message)
}
function invalidCategory() {
  return new ApplicationError(
    "INVALID_INVESTMENT_CATEGORY",
    "Investment category is invalid"
  )
}
