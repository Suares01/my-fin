import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { FormattedMoney } from "@workspace/ui/money"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  HashIcon,
  TrendingUpIcon,
} from "lucide-react"
import type { TransactionFilters } from "../transaction-list-model.js"
import { useTransactionSummary } from "../hooks/use-transaction-summary.js"

export function TransactionSummary({
  filters,
}: {
  readonly filters: TransactionFilters
}) {
  const summary = useTransactionSummary(filters)
  const cards = [
    {
      key: "income",
      label: "Receita total",
      value: summary.data?.incomeMinor,
      icon: ArrowDownLeftIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      isMonetary: true,
    },
    {
      key: "expense",
      label: "Despesa total",
      value: summary.data?.expenseMinor,
      icon: ArrowUpRightIcon,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      isMonetary: true,
    },
    {
      key: "largest",
      label: "Maior transação",
      value: summary.data?.largestTransactionMinor,
      icon: TrendingUpIcon,
      color: "text-primary",
      bg: "bg-primary/10",
      isMonetary: true,
    },
    {
      key: "count",
      label: "Total de transações",
      value: summary.data?.transactionCount,
      icon: HashIcon,
      color: "text-muted-foreground",
      bg: "bg-muted",
      isMonetary: false,
    },
  ] as const

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
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
              <p
                className="text-base font-semibold tracking-tight tabular-nums"
                data-testid={`transaction-summary-${card.key}`}
              >
                {summary.isPending ? (
                  <Skeleton className="h-5 w-24" />
                ) : summary.data === undefined ? (
                  "—"
                ) : card.isMonetary ? (
                  <FormattedMoney
                    amountMinor={String(card.value)}
                    currency={summary.data.currency}
                  />
                ) : (
                  card.value
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
      {summary.isError && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar o resumo</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Verifique os filtros e tente consultar novamente.
            <Button
              type="button"
              variant="outline"
              onClick={() => void summary.refetch()}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
