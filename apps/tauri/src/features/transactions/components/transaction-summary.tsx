import type { JournalChainListItem } from "@workspace/application"

import { cn } from "@workspace/ui/lib/utils"
import { FormattedMoney } from "@workspace/ui/money"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  HashIcon,
  TrendingUpIcon,
} from "lucide-react"
import { useMemo } from "react"

function calculateTotals(
  items: readonly JournalChainListItem[],
  type: "INCOME" | "EXPENSE"
) {
  return items
    .filter((item) => item.type === type)
    .reduce((acc, item) => {
      const amount = BigInt(item.amountMinor)
      acc += amount
      return acc
    }, 0n)
}

export function TransactionSummary({
  items,
}: {
  readonly items: readonly JournalChainListItem[]
}) {
  const income = calculateTotals(items, "INCOME")
  const expense = calculateTotals(items, "EXPENSE")
  const largest = items.reduce<JournalChainListItem | undefined>(
    (current, item) =>
      current === undefined ||
      BigInt(item.amountMinor) > BigInt(current.amountMinor)
        ? item
        : current,
    undefined
  )

  const cards = useMemo(
    () => [
      {
        label: "Receita total",
        value: income,
        icon: ArrowDownLeftIcon,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        isMonetary: true,
      },
      {
        label: "Despesa total",
        value: expense,
        icon: ArrowUpRightIcon,
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        isMonetary: true,
      },
      {
        label: "Maior transação",
        value: largest ? BigInt(largest.amountMinor) : 0n,
        icon: TrendingUpIcon,
        color: "text-primary",
        bg: "bg-primary/10",
        isMonetary: true,
      },
      {
        label: "Total de transações",
        value: items.length,
        icon: HashIcon,
        color: "text-muted-foreground",
        bg: "bg-muted",
        isMonetary: false,
      },
    ],
    [income, expense, largest, items.length]
  )

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              card.bg
            )}
          >
            <card.icon className={cn("size-4", card.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-base font-semibold tracking-tight tabular-nums">
              {card.isMonetary ? (
                <FormattedMoney
                  amountMinor={card.value.toString()}
                  currency="BRL"
                />
              ) : (
                card.value
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
