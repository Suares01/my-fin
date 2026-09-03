import { formatMinorAmount } from "@workspace/ui/money"
import { Landmark, TrendingDown, WalletCards } from "lucide-react"
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

interface AccountSummaryProps {
  readonly accounts: readonly FinancialAccountBalance[]
}

export function AccountSummary({ accounts }: AccountSummaryProps) {
  const summary = summarizeAccounts(accounts)
  const cards = [
    {
      label: "Saldo consolidado",
      value: summary.netWorthMinor,
      icon: WalletCards,
      className: "bg-primary/10 text-primary",
    },
    {
      label: "Ativos",
      value: summary.assetsMinor,
      icon: Landmark,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Passivos",
      value: summary.liabilitiesMinor,
      icon: TrendingDown,
      className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${card.className}`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-base font-semibold tracking-tight tabular-nums">
                {formatMinorAmount(card.value, summary.currency)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
