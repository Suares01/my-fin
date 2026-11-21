import type { InvestmentPortfolioSummary as Portfolio } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatMinorAmount } from "@workspace/ui/money"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react"

type Props = {
  readonly summary: Portfolio | undefined
  readonly accountCount: number | undefined
  readonly isPending: boolean
  readonly isError: boolean
  readonly onRetry: () => void
  readonly onCreateAccount?: () => void
}

function date(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function InvestmentPortfolioSummary({
  summary,
  accountCount,
  isPending,
  isError,
  onRetry,
  onCreateAccount,
}: Props) {
  if (isPending && summary === undefined)
    return (
      <div
        aria-label="Carregando resumo patrimonial"
        aria-busy="true"
        className="flex min-w-0 flex-col gap-3"
      >
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    )

  if (summary === undefined)
    return (
      <ErrorState
        variant="load-error"
        title="Não foi possível carregar o resumo patrimonial"
        description="Os valores não foram substituídos por zero. Tente carregar novamente."
        actionLabel="Tentar novamente"
        onAction={onRetry}
      />
    )

  const money = (minor: string) => formatMinorAmount(minor, summary.currency)
  const signedMoney = (minor: string) =>
    `${BigInt(minor) > 0n ? "+" : ""}${money(minor)}`
  const investedNetWorthMinor = (
    BigInt(summary.investmentMarketValueMinor) +
    BigInt(summary.investmentCashMinor)
  ).toString()
  const negative =
    summary.warnings.some(
      (warning) => warning.code === "INVESTMENT_CASH_NEGATIVE"
    ) || BigInt(summary.investmentCashMinor) < 0n
  const empty =
    accountCount === 0 &&
    summary.openPositionCount === 0 &&
    summary.investmentLedgerMinor === "0"
  const completeCoverage =
    summary.openPositionCount > 0 &&
    summary.valuedPositionCount === summary.openPositionCount
  const noValuation =
    summary.openPositionCount > 0 && summary.valuedPositionCount === 0

  return (
    <section
      aria-label="Resumo patrimonial"
      className="flex min-w-0 flex-col gap-4"
    >
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Dados anteriores; atualização falhou</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Os valores abaixo são os últimos carregados.
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="rounded-2xl bg-investment-hero py-0 text-investment-hero-foreground shadow-none ring-0">
        <CardContent className="grid gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(28rem,1fr)] lg:items-end">
          <div
            data-testid="invested-net-worth"
            className="flex min-w-0 flex-col gap-2"
          >
            <p className="text-sm font-medium text-investment-hero-muted">
              Patrimônio em investimentos
            </p>
            <p className="text-4xl font-semibold tracking-[-0.035em] break-words tabular-nums sm:text-5xl">
              {money(investedNetWorthMinor)}
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-investment-hero-muted">
              Posições pelo valor atual mais o caixa real mantido nas carteiras.
              Não é o patrimônio total do livro.
            </p>
          </div>

          <dl className="grid gap-5 sm:grid-cols-3 lg:gap-4">
            <div data-testid="position-cost-metric" className="min-w-0">
              <dt className="text-xs font-medium text-investment-hero-muted">
                Custo das posições
              </dt>
              <dd className="mt-1 text-lg font-semibold break-words tabular-nums">
                {money(summary.positionCostMinor)}
              </dd>
            </div>
            <div data-testid="unrealized-result-metric" className="min-w-0">
              <dt className="text-xs font-medium text-investment-hero-muted">
                Resultado não realizado
              </dt>
              <dd className="mt-1 text-lg font-semibold break-words text-investment-accent tabular-nums">
                {signedMoney(summary.unrealizedResultMinor)}
              </dd>
            </div>
            <div data-testid="investment-cash-metric" className="min-w-0">
              <dt className="text-xs font-medium text-investment-hero-muted">
                Caixa nas carteiras
              </dt>
              <dd className="mt-1 text-lg font-semibold break-words tabular-nums">
                {money(summary.investmentCashMinor)}
              </dd>
            </div>
          </dl>
        </CardContent>

        <div className="flex flex-col gap-3 border-t border-investment-hero-foreground/15 px-5 py-4 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-2 text-sm">
            {completeCoverage ? (
              <CircleCheckIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-investment-accent"
              />
            ) : (
              <CircleAlertIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-investment-hero-muted"
              />
            )}
            <div className="min-w-0">
              {summary.openPositionCount === 0 ? (
                <p>0 de 0 posições abertas com avaliação atual.</p>
              ) : completeCoverage ? (
                <p>
                  {summary.openPositionCount === 1
                    ? "A única posição aberta tem avaliação atual."
                    : `Todas as ${summary.openPositionCount} posições abertas têm avaliação atual.`}
                </p>
              ) : noValuation ? (
                <p>
                  0 de {summary.openPositionCount} posições abertas com
                  avaliação atual. Sem avaliação atual; usando custo nas
                  posições.
                </p>
              ) : (
                <p>
                  {summary.valuedPositionCount} de {summary.openPositionCount}{" "}
                  posições abertas com avaliação atual. Nas demais, o valor
                  atual usa o custo.
                </p>
              )}
              {summary.valuationDateRange !== null && (
                <p className="mt-1 text-xs leading-relaxed text-investment-hero-muted">
                  Avaliações usadas: {date(summary.valuationDateRange.oldest)} a{" "}
                  {date(summary.valuationDateRange.newest)}; o total não
                  representa uma cotação sincronizada.
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Badge className="border-investment-hero-foreground/20 bg-investment-hero-foreground/10 text-investment-hero-foreground">
              {summary.currency}
            </Badge>
            <Badge className="border-investment-hero-foreground/20 bg-investment-hero-foreground/10 text-investment-hero-foreground">
              Referência {date(summary.asOf)}
            </Badge>
          </div>
        </div>
      </Card>

      <dl className="grid overflow-hidden rounded-2xl border bg-card shadow-none md:grid-cols-3 md:divide-x">
        <div
          data-testid="available-card"
          className="min-w-0 border-b p-4 md:border-b-0"
        >
          <dt className="text-sm text-muted-foreground">Dinheiro disponível</dt>
          <dd className="mt-1 text-xl font-semibold break-words tabular-nums">
            {money(summary.availableMinor)}
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            Contas diárias ativas
          </p>
        </div>
        <div
          data-testid="book-net-worth-card"
          className="min-w-0 border-b p-4 md:border-b-0"
        >
          <dt className="text-sm text-muted-foreground">
            Patrimônio contábil do livro
          </dt>
          <dd className="mt-1 text-xl font-semibold break-words tabular-nums">
            {money(summary.bookNetWorthMinor)}
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            Ativos menos passivos, sem avaliações
          </p>
        </div>
        <div data-testid="market-net-worth-card" className="min-w-0 p-4">
          <dt className="text-sm text-muted-foreground">
            Patrimônio avaliado do livro
          </dt>
          <dd className="mt-1 text-xl font-semibold break-words tabular-nums">
            {money(summary.marketNetWorthMinor)}
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            Patrimônio contábil mais resultado não realizado
          </p>
        </div>
      </dl>

      <details className="group rounded-2xl border bg-muted/30 px-4 py-3 text-sm">
        <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2 font-medium focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none">
          <InfoIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Como estes valores são compostos
        </summary>
        <div className="mt-3 grid gap-2 border-t pt-3 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
          <p>Moeda-base: {summary.currency}</p>
          <p>Data de referência: {date(summary.asOf)}</p>
          <p>
            Valor líquido e resgatável: desconhecidos neste resumo quando não
            informados.
          </p>
          <p>
            Outros ativos: {money(summary.otherAssetsMinor)}. Fora do dinheiro
            disponível.
          </p>
          <p>
            Saldos diários arquivados:{" "}
            {money(summary.archivedDailyAccountBalanceMinor)}. Incluídos no
            patrimônio contábil.
          </p>
          <p>Caixa das carteiras: {money(summary.investmentCashMinor)}.</p>
        </div>
      </details>

      {negative && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>
            Valores calculados com inconsistências; revise saldos e aportes
          </AlertTitle>
          <AlertDescription>
            Saldo da carteira menor que o custo alocado; revise os registros.
          </AlertDescription>
        </Alert>
      )}

      {empty && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhuma carteira ou posição cadastrada.</EmptyTitle>
          </EmptyHeader>
          {onCreateAccount && (
            <EmptyContent>
              <Button onClick={onCreateAccount}>Cadastrar carteira</Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </section>
  )
}
