import type { InvestmentPortfolioSummary as Portfolio } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatMinorAmount } from "@workspace/ui/money"

type Props = {
  readonly summary: Portfolio | undefined
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
  isPending,
  isError,
  onRetry,
  onCreateAccount,
}: Props) {
  if (isPending && summary === undefined)
    return (
      <div
        aria-label="Carregando resumo patrimonial"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
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
  const negative =
    summary.warnings.some(
      (warning) => warning.code === "INVESTMENT_CASH_NEGATIVE"
    ) || BigInt(summary.investmentCashMinor) < 0n
  const empty =
    summary.openPositionCount === 0 && summary.investmentLedgerMinor === "0"
  const cards = [
    {
      id: "available-card",
      label: "Dinheiro disponível",
      value: summary.availableMinor,
      description: "Contas diárias ativas",
    },
    {
      id: "book-net-worth-card",
      label: "Patrimônio contábil",
      value: summary.bookNetWorthMinor,
      description: "Ativos menos passivos no livro",
    },
    {
      id: "market-net-worth-card",
      label: "Patrimônio avaliado",
      value: summary.marketNetWorthMinor,
      description: "Patrimônio contábil mais resultado não realizado",
    },
  ] as const

  return (
    <section
      aria-label="Resumo patrimonial"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Moeda-base: {summary.currency}</Badge>
        <span className="text-sm text-muted-foreground">
          Data de referência: {date(summary.asOf)}
        </span>
      </div>
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Dados anteriores; atualização falhou</AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.id}
            size="sm"
            data-testid={card.id}
            className="min-w-0"
          >
            <CardHeader>
              <CardTitle>{card.label}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold break-words tabular-nums">
                {money(card.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>
          {summary.valuedPositionCount} de {summary.openPositionCount} posições
          abertas com avaliação atual.
        </p>
        {summary.valuationDateRange === null ? (
          <p>
            Sem avaliação atual; usando custo nas posições sem observação
            vigente.
          </p>
        ) : (
          <p>
            Avaliações usadas: {date(summary.valuationDateRange.oldest)} a{" "}
            {date(summary.valuationDateRange.newest)}; o total não representa
            uma cotação sincronizada.
          </p>
        )}
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
