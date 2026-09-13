import type { InvestmentOperationType } from "../operations/investment-operation.js"

export interface InvestmentAccountingAccounts {
  readonly investmentAccountId: string
  readonly externalAccountId?: string
  readonly gainCategoryId?: string
  readonly lossCategoryId?: string
  readonly incomeCategoryId?: string
  readonly feeCategoryId?: string
  readonly taxCategoryId?: string
}

export interface InvestmentAccountingPlanInput {
  readonly type: InvestmentOperationType
  readonly capitalMinor: string
  readonly grossAmountMinor: string
  readonly feesMinor?: string
  readonly taxesMinor?: string
  readonly cashMode: "NONE" | "INTERNAL_CASH" | "EXTERNAL_ACCOUNT"
  readonly accounts: InvestmentAccountingAccounts
}

export interface InvestmentAccountingDelta {
  readonly accountId: string
  readonly amountMinor: string
}

export interface InvestmentAccountingPlan {
  readonly bookCostDeltaMinor: string
  readonly netCashFlowMinor: string
  readonly postings: readonly InvestmentAccountingDelta[]
}

/**
 * Produces the accounting effect of one already-validated investment fact.
 * Positive amounts increase an asset/expense account and negative amounts
 * increase an income account, matching the existing journal convention.
 */
export function planInvestmentAccounting(
  input: InvestmentAccountingPlanInput
): InvestmentAccountingPlan {
  const capital = integer(input.capitalMinor)
  const gross = integer(input.grossAmountMinor)
  const fees = integer(input.feesMinor ?? "0")
  const taxes = integer(input.taxesMinor ?? "0")
  const expenses = fees + taxes
  const accounts = input.accounts
  const deltas: Array<[string | undefined, bigint]> = []
  const add = (accountId: string | undefined, amount: bigint) => {
    if (amount !== 0n) deltas.push([accountId, amount])
  }
  const require = (accountId: string | undefined): string => {
    if (accountId === undefined || accountId.length === 0) {
      invalid()
    }
    return accountId
  }
  const routeCash = (amount: bigint) => {
    if (input.cashMode === "NONE") return
    add(
      input.cashMode === "EXTERNAL_ACCOUNT"
        ? require(accounts.externalAccountId)
        : accounts.investmentAccountId,
      amount
    )
  }
  const addExpenses = () => {
    add(fees === 0n ? undefined : require(accounts.feeCategoryId), fees)
    add(taxes === 0n ? undefined : require(accounts.taxCategoryId), taxes)
  }

  if (input.type === "OPENING_ALLOCATION") {
    return { bookCostDeltaMinor: capital.toString(), netCashFlowMinor: "0", postings: [] }
  }

  if (input.type === "APPLICATION" || input.type === "PURCHASE") {
    if (capital <= 0n || gross !== 0n || input.cashMode === "NONE") invalid()
    routeCash(-(capital + expenses))
    add(accounts.investmentAccountId, capital)
    addExpenses()
    return result(capital, -(capital + expenses), deltas)
  }

  if (input.type === "FEE" || input.type === "TAX") {
    const amount = input.type === "FEE" ? fees : taxes
    if (amount <= 0n || input.cashMode !== "INTERNAL_CASH" || capital !== 0n || gross !== 0n) invalid()
    routeCash(-amount)
    add(input.type === "FEE" ? require(accounts.feeCategoryId) : require(accounts.taxCategoryId), amount)
    return result(0n, -amount, deltas)
  }

  if (input.type === "INCOME") {
    if (capital !== 0n || gross <= 0n || input.cashMode !== "INTERNAL_CASH") invalid()
    const net = gross - expenses
    if (net < 0n) invalid()
    routeCash(net)
    add(require(accounts.incomeCategoryId), -gross)
    addExpenses()
    return result(0n, net, deltas)
  }

  if (
    input.type === "SALE" ||
    input.type === "REDEMPTION" ||
    input.type === "AMORTIZATION"
  ) {
    if (capital < 0n || gross < 0n || input.cashMode === "NONE") invalid()
    const resultGross = gross - capital
    const net = gross - expenses
    if (net < 0n) invalid()
    if (input.type === "AMORTIZATION" && capital <= 0n) invalid()
    routeCash(net)
    add(accounts.investmentAccountId, -capital)
    if (resultGross > 0n) add(require(accounts.gainCategoryId), -resultGross)
    if (resultGross < 0n) add(require(accounts.lossCategoryId), -resultGross)
    addExpenses()
    return result(-capital, net, deltas)
  }

  invalid()
}

function result(
  bookCostDeltaMinor: bigint,
  netCashFlowMinor: bigint,
  deltas: readonly (readonly [string | undefined, bigint])[]
): InvestmentAccountingPlan {
  const grouped = new Map<string, bigint>()
  for (const [accountId, amount] of deltas) {
    if (accountId === undefined) continue
    grouped.set(accountId, (grouped.get(accountId) ?? 0n) + amount)
  }
  const postings = [...grouped].flatMap(([accountId, amount]) =>
    amount === 0n ? [] : [{ accountId, amountMinor: amount.toString() }]
  )
  if (postings.length === 1 || postings.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n) !== 0n) invalid()
  return { bookCostDeltaMinor: bookCostDeltaMinor.toString(), netCashFlowMinor: netCashFlowMinor.toString(), postings }
}

function integer(value: string): bigint {
  if (!/^-?\d+$/.test(value)) invalid()
  return BigInt(value)
}

function invalid(): never {
  throw new Error("Invalid investment accounting plan")
}
