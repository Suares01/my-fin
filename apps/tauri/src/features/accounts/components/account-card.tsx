import type { AccountBalanceItemView } from "@workspace/application"
import { formatMinorAmount } from "@workspace/ui/money"
import { Landmark, WalletCards } from "lucide-react"

export type FinancialAccountBalance = AccountBalanceItemView & {
  readonly accountKind: "ASSET" | "LIABILITY"
}

const accountAppearance = {
  ASSET: {
    label: "Ativo",
    description: "Conta de ativo",
    accent: "bg-emerald-500",
    icon: WalletCards,
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  LIABILITY: {
    label: "Passivo",
    description: "Conta de passivo",
    accent: "bg-rose-500",
    icon: Landmark,
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
} as const

interface AccountCardProps {
  readonly account: FinancialAccountBalance
}

export function AccountCard({ account }: AccountCardProps) {
  const appearance = accountAppearance[account.accountKind]
  const Icon = appearance.icon

  return (
    <article className="group relative overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
      <div className={`absolute inset-y-0 left-0 w-1 ${appearance.accent}`} />
      <div className="p-4 pl-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <span className="text-xs text-muted-foreground">
            {appearance.description}
          </span>
        </div>

        <div className="mt-4">
          <h2 className="truncate text-sm font-semibold">
            {account.accountName}
          </h2>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${appearance.badge}`}
          >
            {appearance.label}
          </span>
        </div>

        <p className="mt-4 text-xl font-bold tracking-tight tabular-nums">
          {formatMinorAmount(account.displayBalanceMinor, account.currency)}
        </p>
      </div>
    </article>
  )
}
