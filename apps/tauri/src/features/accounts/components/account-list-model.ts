import type { AccountBalanceItemView } from "@workspace/application"
import type { FinancialAccountBalance } from "./account-card"

export type AccountFilter = "ALL" | "ASSET" | "LIABILITY"

export function filterAccounts(
  accounts: readonly AccountBalanceItemView[],
  filter: AccountFilter
): readonly FinancialAccountBalance[] {
  return accounts.filter(
    (account): account is FinancialAccountBalance =>
      (account.accountKind === "ASSET" ||
        account.accountKind === "LIABILITY") &&
      (filter === "ALL" || account.accountKind === filter)
  )
}
