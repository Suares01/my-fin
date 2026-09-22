import {
  assertRequiredBookCost,
  bookIdFromString,
  Currency,
  InvestmentPosition,
  investmentPositionIdFromString,
  Money,
  planInvestmentAccounting,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import type {
  InvestmentOpeningPreview,
  PreviewInvestmentPositionOpeningCommand,
  RepositoryContext,
  TransactionManager,
} from "../../ports/index.js"

/** Read-only preview for a position that does not exist yet. */
export class PreviewInvestmentPositionOpening {
  constructor(private readonly transactionManager: TransactionManager) {}

  async execute(
    command: PreviewInvestmentPositionOpeningCommand
  ): Promise<ResultType<InvestmentOpeningPreview, ApplicationError>> {
    try {
      const transaction = await this.transactionManager.execute(
        async (repositories) => {
          const book = await repositories.books.findById(
            bookIdFromString(command.bookId)
          )
          if (book === null) throw missing("Financial book")
          const currency = book.baseCurrency.code
          if (command.kind === "PURCHASE" && command.currency !== currency)
            throw new ApplicationError(
              "CURRENCY_MISMATCH",
              "Investment opening must use book currency"
            )

          const account = await repositories.accounts.findById(
            command.investmentAccountId as never
          )
          if (account === null) throw missing("Investment account")
          if (account.bookId !== book.id) throw mismatch("Investment account")
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
            throw missing("Investment instrument")
          if (instrument.kind === "BOOK_MISMATCH")
            throw mismatch("Investment instrument")
          if (instrument.value.status !== "ACTIVE") throw inactive()

          const capital =
            command.kind === "ALLOCATION"
              ? requiredCost(command.bookCostMinor, currency)
              : purchaseCapital(command.capitalMinor)
          const quantity =
            command.kind === "ALLOCATION"
              ? command.quantity
              : command.quantityDelta
          InvestmentPosition.openWithAllocation({
            // Transient, deterministic identity: never allocated or persisted.
            id: investmentPositionIdFromString("__opening_preview__"),
            bookId: book.id,
            investmentAccountId: account.id,
            instrumentId: instrument.value.id,
            instrumentClass: instrument.value.instrumentClass,
            ...(command.label === undefined ? {} : { label: command.label }),
            quantityMode: command.quantityMode,
            ...(quantity === undefined ? {} : { quantity }),
            bookCostMinor: capital,
            currency,
            openedOn: command.occurredOn,
            ...(command.fixedIncomeTerms === undefined
              ? {}
              : { fixedIncomeTerms: command.fixedIncomeTerms as never }),
          })

          let externalAccountId: string | undefined
          let categories: Record<string, string> = {}
          if (command.kind === "PURCHASE") {
            validatePurchase(command)
            externalAccountId = await externalFor(
              repositories,
              book.id,
              account.id,
              command.funding
            )
            categories = await expenseCategories(repositories, book.id, command)
          }
          const plan = planInvestmentAccounting({
            type:
              command.kind === "ALLOCATION"
                ? "OPENING_ALLOCATION"
                : command.type,
            capitalMinor: capital,
            grossAmountMinor: "0",
            ...(command.kind === "ALLOCATION"
              ? {}
              : {
                  feesMinor: command.feesMinor,
                  taxesMinor: command.taxesMinor,
                }),
            cashMode:
              command.kind === "ALLOCATION" ? "NONE" : command.funding.mode,
            accounts: {
              investmentAccountId: account.id,
              ...(externalAccountId === undefined ? {} : { externalAccountId }),
              ...categories,
            },
          })

          let openingBalanceMinor: string | undefined
          if (
            command.kind === "ALLOCATION" &&
            command.proposedOpeningBalanceMinor !== undefined
          ) {
            openingBalanceMinor = proposedOpeningBalance(
              command.proposedOpeningBalanceMinor
            )
            if (
              (await repositories.journalEntries.findActiveOpeningBalanceByAccount(
                book.id,
                account.id
              )) !== null
            )
              throw new ApplicationError(
                "OPENING_BALANCE_ALREADY_SET",
                "An active opening balance already exists"
              )
          }
          const current = (
            await repositories.investmentReads.accountCash(
              book.id,
              [account.id],
              command.occurredOn
            )
          )[0]
          if (current === undefined)
            throw new ApplicationError(
              "UNEXPECTED_ERROR",
              "Investment cash state was not returned"
            )
          const postingDelta = plan.postings
            .filter((posting) => posting.accountId === account.id)
            .reduce((sum, posting) => sum + BigInt(posting.amountMinor), 0n)
          const projectedCashMinor = (
            BigInt(current.cashMinor) +
            postingDelta +
            BigInt(openingBalanceMinor ?? "0") -
            BigInt(plan.bookCostDeltaMinor)
          ).toString()
          return {
            bookCostDeltaMinor: plan.bookCostDeltaMinor,
            netCashFlowMinor: plan.netCashFlowMinor,
            postings: plan.postings,
            categories,
            projectedCashMinor,
            ...(openingBalanceMinor === undefined
              ? {}
              : { openingBalanceMinor }),
            warnings:
              BigInt(projectedCashMinor) < 0n
                ? [
                    {
                      code: "INVESTMENT_CASH_NEGATIVE" as const,
                      investmentAccountId: account.id,
                      cashMinor: projectedCashMinor,
                      currency: current.currency,
                      asOf: command.occurredOn,
                    },
                  ]
                : [],
          } satisfies InvestmentOpeningPreview
        }
      )
      return Result.ok(transaction.value)
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}

function requiredCost(value: unknown, currency: string): string {
  const money =
    value === undefined
      ? undefined
      : typeof value === "string" && /^\d+$/.test(value)
        ? Money.of(BigInt(value), Currency.parse(currency))
        : undefined
  if (value !== undefined && money === undefined)
    throw invalid("Investment book cost is invalid")
  return assertRequiredBookCost(money).amountMinor.toString()
}

function purchaseCapital(value: string): string {
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n)
    throw invalid("Investment capital is invalid")
  return value
}

function proposedOpeningBalance(value: string): string {
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n)
    throw invalid("Proposed opening balance is invalid")
  if (BigInt(value) > 9223372036854775807n)
    throw new ApplicationError(
      "INVESTMENT_VALUE_OUT_OF_RANGE",
      "Proposed opening balance is out of range"
    )
  return BigInt(value).toString()
}

function validatePurchase(
  command: Extract<
    PreviewInvestmentPositionOpeningCommand,
    { kind: "PURCHASE" }
  >
) {
  if (command.type !== "PURCHASE" && command.type !== "APPLICATION")
    throw invalid("Opening operation must be purchase or application")
  if (
    command.funding?.mode !== "INTERNAL_CASH" &&
    command.funding?.mode !== "EXTERNAL_ACCOUNT"
  )
    throw invalid("Investment funding route must be explicit")
  for (const amount of [command.feesMinor, command.taxesMinor])
    if (amount !== undefined && !/^\d+$/.test(amount))
      throw invalid("Investment expenses are invalid")
}

async function externalFor(
  repositories: RepositoryContext,
  bookId: string,
  investmentAccountId: string,
  funding: Extract<
    PreviewInvestmentPositionOpeningCommand,
    { kind: "PURCHASE" }
  >["funding"]
): Promise<string | undefined> {
  if (funding.mode === "INTERNAL_CASH") return undefined
  const account = await repositories.accounts.findById(
    funding.accountId as never
  )
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

async function expenseCategories(
  repositories: RepositoryContext,
  bookId: string,
  command: Extract<
    PreviewInvestmentPositionOpeningCommand,
    { kind: "PURCHASE" }
  >
): Promise<Record<string, string>> {
  const categories: Record<string, string> = {}
  for (const [amount, id, key] of [
    [command.feesMinor, command.feeCategoryId, "feeCategoryId"],
    [command.taxesMinor, command.taxCategoryId, "taxCategoryId"],
  ] as const) {
    if (BigInt(amount ?? "0") === 0n) continue
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
      account.kind !== "EXPENSE" ||
      account.systemPurpose !== undefined
    )
      throw new ApplicationError(
        "INVALID_INVESTMENT_CATEGORY",
        "Investment category is invalid"
      )
    categories[key] = account.id
  }
  return categories
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
function inactive() {
  return new ApplicationError(
    "INVESTMENT_ENTITY_NOT_ACTIVE",
    "Investment account and instrument must be active"
  )
}
function invalid(message: string) {
  return new ApplicationError("INVALID_INVESTMENT_OPERATION", message)
}
