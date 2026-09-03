import type { JournalChainListItem } from "@workspace/application"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FormattedMoney } from "@workspace/ui/money"

type MonetaryTotal = {
  readonly currency: string
  readonly amountMinor: bigint
}

function totalsByCurrency(
  items: readonly JournalChainListItem[],
  type: "INCOME" | "EXPENSE"
): readonly MonetaryTotal[] {
  const totals = new Map<string, bigint>()

  for (const item of items) {
    if (item.type !== type) continue
    const amount = BigInt(item.amountMinor)
    totals.set(item.currency, (totals.get(item.currency) ?? 0n) + amount)
  }

  return [...totals.entries()].map(([currency, amountMinor]) => ({
    currency,
    amountMinor,
  }))
}

function SummaryAmount({
  totals,
  sign,
  name,
}: {
  readonly totals: readonly MonetaryTotal[]
  readonly sign: "+" | "-" | ""
  readonly name: "income" | "expense"
}) {
  if (totals.length === 0) return <span>—</span>

  return totals.map(({ currency, amountMinor }) => (
    <span
      key={currency}
      data-testid={`transaction-summary-${name}-${currency}`}
      className="block text-2xl font-semibold tracking-tight"
    >
      {sign}
      <FormattedMoney
        amountMinor={amountMinor.toString()}
        currency={currency}
      />
    </span>
  ))
}

function SummaryCard({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>resultados carregados</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function TransactionSummary({
  items,
}: {
  readonly items: readonly JournalChainListItem[]
}) {
  const income = totalsByCurrency(items, "INCOME")
  const expense = totalsByCurrency(items, "EXPENSE")
  const largest = items.reduce<JournalChainListItem | undefined>(
    (current, item) =>
      current === undefined ||
      BigInt(item.amountMinor) > BigInt(current.amountMinor)
        ? item
        : current,
    undefined
  )

  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Resumo das transações"
    >
      <SummaryCard title="Receitas">
        <SummaryAmount totals={income} sign="+" name="income" />
      </SummaryCard>
      <SummaryCard title="Despesas">
        <SummaryAmount totals={expense} sign="-" name="expense" />
      </SummaryCard>
      <SummaryCard title="Maior valor">
        {largest === undefined ? (
          <span>—</span>
        ) : (
          <span data-testid="transaction-summary-largest">
            <FormattedMoney
              amountMinor={largest.amountMinor}
              currency={largest.currency}
              className="text-2xl font-semibold tracking-tight"
            />
          </span>
        )}
      </SummaryCard>
      <SummaryCard title="Transações">
        <span
          data-testid="transaction-summary-count"
          className="text-2xl font-semibold tracking-tight"
        >
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
      </SummaryCard>
    </section>
  )
}
