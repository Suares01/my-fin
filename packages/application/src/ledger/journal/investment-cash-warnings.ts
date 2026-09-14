import type { LedgerAccountId } from "@workspace/domain"
import type { InvestmentWarning } from "../../ports/investment-commands.js"
import type { RepositoryContext } from "../../ports/repositories.js"

export async function investmentCashWarnings(
  repositories: RepositoryContext,
  bookId: string,
  accountIds: readonly LedgerAccountId[],
  asOf: string
): Promise<readonly InvestmentWarning[]> {
  const accounts = await Promise.all(
    [...new Set(accountIds)].map((id) => repositories.accounts.findById(id))
  )
  const investmentAccountIds = accounts.flatMap((account) =>
    account?.bookId === bookId &&
    account.financialAccount?.type === "INVESTMENT_ACCOUNT"
      ? [account.id]
      : []
  )
  const cash = await repositories.investmentReads.accountCash(
    bookId,
    investmentAccountIds,
    asOf
  )
  return cash
    .filter((value) => BigInt(value.cashMinor) < 0n)
    .map((value) => ({
      code: "INVESTMENT_CASH_NEGATIVE" as const,
      investmentAccountId: value.investmentAccountId,
      cashMinor: value.cashMinor,
      currency: value.currency,
      asOf,
    }))
}

export function withInvestmentCashWarnings<T extends object>(
  result: T,
  warnings: readonly InvestmentWarning[]
): T & { readonly warnings?: readonly InvestmentWarning[] } {
  return warnings.length === 0 ? result : { ...result, warnings }
}
