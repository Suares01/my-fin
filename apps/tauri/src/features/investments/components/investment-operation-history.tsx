import type { InvestmentOperationHistoryItem } from "@workspace/application"
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatMinorAmount } from "@workspace/ui/money"
import { MoreHorizontalIcon } from "lucide-react"
import { useRef } from "react"
import { correctableOperation } from "../forms/investment-correction-form-model"
import { useInvestmentOperations } from "../hooks"

type Props = {
  readonly positionId: string | undefined
  readonly onCorrect: (operation: InvestmentOperationHistoryItem) => void
  readonly canCorrect?: boolean
}

const operationLabels: Record<string, string> = {
  OPENING_ALLOCATION: "Abertura",
  PURCHASE: "Compra",
  APPLICATION: "Aplicação",
  SALE: "Venda",
  REDEMPTION: "Resgate",
  AMORTIZATION: "Amortização",
  INCOME: "Rendimento",
  FEE: "Tarifa",
  TAX: "Imposto",
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

function cashRoute(operation: InvestmentOperationHistoryItem): string {
  switch (operation.cashMode) {
    case "INTERNAL_CASH":
      return "Caixa da carteira"
    case "EXTERNAL_ACCOUNT":
      return operation.settlementAccountId
        ? `Conta externa ${operation.settlementAccountId}`
        : "Conta externa"
    default:
      return "Sem fluxo de caixa"
  }
}

export function InvestmentOperationHistory({
  positionId,
  onCorrect,
  canCorrect = true,
}: Props) {
  const query = useInvestmentOperations(positionId)
  const drawerContainerRef = useRef<HTMLElement | null>(null)

  if (positionId === undefined)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Selecione uma posição para ver operações.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )

  const operations = query.data?.items
  const lastEffectiveOperationId = operations?.find(
    (operation) =>
      operation.role === "BUSINESS" &&
      operation.reversedBy === undefined &&
      operation.replacedBy === undefined
  )?.id

  if (query.isPending && operations === undefined)
    return (
      <div aria-label="Carregando operações" className="flex flex-col gap-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )

  if (operations === undefined)
    return (
      <ErrorState
        variant="load-error"
        title="Não foi possível carregar as operações"
        description="O histórico não foi substituído por uma lista vazia."
        actionLabel="Tentar novamente"
        onAction={() => void query.refetch()}
      />
    )

  return (
    <section
      ref={(node) => {
        drawerContainerRef.current =
          node?.closest<HTMLElement>('[data-slot="drawer-content"]') ?? null
      }}
      aria-label="Histórico de operações"
      className="flex min-w-0 flex-col gap-4"
    >
      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>
            Dados anteriores; atualização das operações falhou
          </AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {operations.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhuma operação registrada nesta posição.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {operations.map((operation) => {
            const canCorrectOperation =
              lastEffectiveOperationId !== undefined &&
              canCorrect &&
              correctableOperation(operation, lastEffectiveOperationId)
            const money = (minor: string) =>
              formatMinorAmount(minor, operation.currency)
            return (
              <Card
                key={operation.id}
                size="sm"
                data-testid={`operation-${operation.id}`}
                className="min-w-0"
              >
                <CardHeader>
                  <CardTitle>
                    {operationLabels[operation.type] ?? operation.type}
                  </CardTitle>
                  <CardDescription className="break-words">
                    {operation.description}
                  </CardDescription>
                  <Badge
                    variant={
                      operation.role === "REVERSAL" ? "secondary" : "outline"
                    }
                  >
                    {operation.role === "REVERSAL"
                      ? "Reversão"
                      : operation.replacedBy
                        ? "Substituída"
                        : operation.reversedBy
                          ? "Cancelada"
                          : "Efetiva"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Ocorrência
                      </dt>
                      <dd>{date(operation.occurredOn)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Registro
                      </dt>
                      <dd>{recordedAt(operation.recordedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Liquidação
                      </dt>
                      <dd>
                        {operation.settledOn
                          ? date(operation.settledOn)
                          : "Não informada"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Quantidade
                      </dt>
                      <dd>{operation.quantityDelta ?? "Não informada"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Bruto</dt>
                      <dd>{money(operation.grossAmountMinor)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Fluxo líquido
                      </dt>
                      <dd>{money(operation.netCashFlowMinor)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Variação do custo
                      </dt>
                      <dd>{money(operation.bookCostDeltaMinor)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Tarifas</dt>
                      <dd>{money(operation.feesMinor)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Impostos
                      </dt>
                      <dd>{money(operation.taxesMinor)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Origem do caixa
                      </dt>
                      <dd className="break-words">{cashRoute(operation)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Lançamento contábil
                      </dt>
                      <dd className="break-words">
                        {operation.journalEntryId ?? "Sem lançamento contábil"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Estado anterior
                      </dt>
                      <dd>
                        {operation.beforeStatus === "OPEN"
                          ? "Aberta"
                          : operation.beforeStatus === "CLOSED"
                            ? "Encerrada"
                            : "Não havia posição"}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {operation.reversalOf && (
                      <p>Reverte: {operation.reversalOf}</p>
                    )}
                    {operation.reversedBy && (
                      <p>Revertida por: {operation.reversedBy}</p>
                    )}
                    {operation.replacementOf && (
                      <p>Substitui: {operation.replacementOf}</p>
                    )}
                    {operation.replacedBy && (
                      <p>Substituída por: {operation.replacedBy}</p>
                    )}
                  </div>
                </CardContent>
                {canCorrectOperation && (
                  <CardFooter>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Ações da operação ${operation.id}`}
                          />
                        }
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        container={drawerContainerRef}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => onCorrect(operation)}
                          >
                            Corrigir operação
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardFooter>
                )}
              </Card>
            )
          })}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage
                ? "Carregando mais..."
                : "Carregar mais operações"}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
