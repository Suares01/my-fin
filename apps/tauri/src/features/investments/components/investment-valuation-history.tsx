import type {
  InvestmentPositionView,
  InvestmentValuationHistoryItem,
} from "@workspace/application"
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
import { Empty, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatMinorAmount } from "@workspace/ui/money"
import { useInvestmentValuations } from "../hooks"

type Props = {
  readonly position: InvestmentPositionView | undefined
  readonly canRecord: boolean
  readonly onRecord: (position: InvestmentPositionView) => void
}

function date(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function recordedAt(value: string): string {
  return (
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value)) + " UTC"
  )
}

function isCurrent(
  item: InvestmentValuationHistoryItem,
  position: InvestmentPositionView
): boolean {
  return (
    position.status === "OPEN" &&
    position.valuation.basis === "VALUATION" &&
    position.valuation.valuationId === item.id &&
    item.allocationRevision === position.allocationRevision
  )
}

export function InvestmentValuationHistory({
  position,
  canRecord,
  onRecord,
}: Props) {
  const query = useInvestmentValuations(position?.id)

  if (position === undefined)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Selecione uma posição para ver avaliações.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )

  const valuations = query.data?.items

  if (query.isPending && valuations === undefined)
    return (
      <div aria-label="Carregando avaliações" className="flex flex-col gap-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )

  if (valuations === undefined)
    return (
      <ErrorState
        variant="load-error"
        title="Não foi possível carregar as avaliações"
        description="O histórico não foi substituído por uma lista vazia."
        actionLabel="Tentar novamente"
        onAction={() => void query.refetch()}
      />
    )

  return (
    <section
      aria-label="Histórico de avaliações"
      className="flex min-w-0 flex-col gap-4"
    >
      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>
            Dados anteriores; atualização das avaliações falhou
          </AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {position.status === "CLOSED" ? (
        <p className="text-sm text-muted-foreground">
          Posição encerrada; avaliações preservadas apenas no histórico. Valor
          atual consolidado: {formatMinorAmount("0", position.currency)}.
        </p>
      ) : position.valuation.basis === "BOOK_COST" ? (
        <p className="text-sm text-muted-foreground">
          Sem avaliação atual; usando custo. Observações de revisões anteriores
          continuam no histórico.
        </p>
      ) : null}
      {canRecord && position.status === "OPEN" && (
        <Button onClick={() => onRecord(position)}>
          Registrar nova avaliação
        </Button>
      )}
      {valuations.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhuma avaliação registrada nesta posição.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {valuations.map((item) => (
            <Card
              key={item.id}
              size="sm"
              data-testid={`valuation-${item.id}`}
              className="min-w-0"
            >
              <CardHeader>
                <CardTitle>Avaliação de {date(item.valuedAt)}</CardTitle>
                <CardDescription>
                  Registrada em {recordedAt(item.recordedAt)}
                </CardDescription>
                <Badge
                  variant={isCurrent(item, position) ? "outline" : "secondary"}
                >
                  {isCurrent(item, position) ? "Atual" : "Histórica"}
                </Badge>
              </CardHeader>
              <CardContent>
                <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Valor bruto
                    </dt>
                    <dd>
                      {formatMinorAmount(item.grossValueMinor, item.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Valor líquido
                    </dt>
                    <dd>
                      {item.netValueMinor === undefined
                        ? "Desconhecido"
                        : formatMinorAmount(item.netValueMinor, item.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Resgatável
                    </dt>
                    <dd>
                      {item.withdrawableValueMinor === undefined
                        ? "Desconhecido"
                        : formatMinorAmount(
                            item.withdrawableValueMinor,
                            item.currency
                          )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Revisão da alocação
                    </dt>
                    <dd>{item.allocationRevision}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Quantidade observada
                    </dt>
                    <dd>{item.quantity ?? "Desconhecida"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Preço unitário
                    </dt>
                    <dd>
                      {item.unitPrice === undefined
                        ? "Desconhecido"
                        : `${item.unitPrice} ${item.currency}`}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage
                ? "Carregando mais..."
                : "Carregar mais avaliações"}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
