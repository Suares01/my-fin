import type { FinancialAccountBalance } from "./account-card"

export type AccountSummary = {
  readonly assetsMinor: string
  readonly liabilitiesMinor: string
  readonly netWorthMinor: string
  readonly currency: string
}

export function summarizeAccounts(
  accounts: readonly FinancialAccountBalance[]
): AccountSummary {
  const assets = accounts.reduce(
    (total, account) =>
      account.accountKind === "ASSET"
        ? total + BigInt(account.displayBalanceMinor)
        : total,
    0n
  )
  const liabilities = accounts.reduce(
    (total, account) =>
      account.accountKind === "LIABILITY"
        ? total + BigInt(account.displayBalanceMinor)
        : total,
    0n
  )

  return {
    assetsMinor: assets.toString(),
    liabilitiesMinor: liabilities.toString(),
    netWorthMinor: (assets - liabilities).toString(),
    currency: accounts[0]?.currency ?? "BRL",
  }
}
