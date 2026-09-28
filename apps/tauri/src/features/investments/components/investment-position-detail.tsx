import type {
  InvestmentOperationHistoryItem,
  InvestmentPositionView,
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
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Empty, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@workspace/ui/components/tabs"
import { formatMinorAmount } from "@workspace/ui/money"
import { useState } from "react"
import {
  useInvestmentAccounts,
  useInvestmentInstruments,
  useInvestmentPosition,
} from "../hooks"
import { InvestmentOperationHistory } from "./investment-operation-history"
import { InvestmentValuationHistory } from "./investment-valuation-history"

export type InvestmentPositionAction =
  | "purchase"
  | "sale"
  | "income"
  | "amortization"
  | "fee"
  | "tax"
  | "valuation"
  | "metadata"

type Props = {
  readonly positionId: string | undefined
  readonly onAction: (
    action: InvestmentPositionAction,
    position: InvestmentPositionView
  ) => void
  readonly onCorrect: (operation: InvestmentOperationHistoryItem) => void
}

const classNames: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  EQUITY: "Ações",
  FUND: "Fundos",
  PENSION: "Previdência",
  STRUCTURED: "Estruturados",
  CRYPTO: "Criptoativos",
  OTHER: "Outros",
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function terms(position: InvestmentPositionView) {
  const data = position.fixedIncomeTerms
  if (data === undefined) return []
  return [
    data.rateKind && {
      label: "Rentabilidade",
      value:
        data.rateKind === "PREFIXED"
          ? "Prefixada"
          : data.rateKind === "INDEXED"
            ? "Indexada"
            : "Híbrida",
    },
    data.index && { label: "Índice", value: data.index },
    data.annualRate && { label: "Taxa anual", value: `${data.annualRate}%` },
    data.indexPercentage && {
      label: "Percentual do índice",
      value: `${data.indexPercentage}%`,
    },
    data.annualSpreadRate && {
      label: "Spread anual",
      value: `${data.annualSpreadRate}%`,
    },
    data.issueDate && {
      label: "Emissão",
      value: formatDate(data.issueDate),
    },
    data.gracePeriodDate && {
      label: "Carência",
      value: formatDate(data.gracePeriodDate),
    },
    data.maturityDate && {
      label: "Vencimento",
      value: formatDate(data.maturityDate),
    },
  ].filter((term): term is { label: string; value: string } => Boolean(term))
}

export function InvestmentPositionDetail({
  positionId,
  onAction,
  onCorrect,
}: Props) {
  const [tab, setTab] = useState<"operations" | "valuations">("operations")
  const positionQuery = useInvestmentPosition(positionId)
  const accountsQuery = useInvestmentAccounts()
  const instrumentsQuery = useInvestmentInstruments()

  if (positionId === undefined)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Selecione uma posição para ver os detalhes.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )

  if (positionQuery.isPending && positionQuery.data === undefined)
    return (
      <div
        aria-label="Carregando detalhe da posição"
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )

  if (positionQuery.data === undefined)
    return (
      <ErrorState
        variant="load-error"
        title="Não foi possível carregar a posição"
        actionLabel="Tentar novamente"
        onAction={() => void positionQuery.refetch()}
      />
    )

  const position = positionQuery.data
  if (position === null)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Posição não encontrada neste livro.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )

  const account = accountsQuery.data?.find(
    (item) => item.id === position.investmentAccountId
  )
  const instrument = instrumentsQuery.data?.find(
    (item) => item.id === position.instrumentId
  )
  const catalogReady =
    accountsQuery.data !== undefined && instrumentsQuery.data !== undefined
  const archived =
    catalogReady &&
    (account?.status !== "ACTIVE" || instrument?.status !== "ACTIVE")
  const canAct = catalogReady && !archived
  const isOpen = position.status === "OPEN"
  const money = (minor: string) => formatMinorAmount(minor, position.currency)
  const knownTerms = terms(position)
  const actions: readonly {
    readonly key: InvestmentPositionAction
    readonly label: string
    readonly enabled: boolean
  }[] = [
    { key: "purchase", label: "Comprar ou aplicar", enabled: isOpen },
    { key: "sale", label: "Vender ou resgatar", enabled: isOpen },
    { key: "income", label: "Registrar rendimento", enabled: true },
    { key: "amortization", label: "Registrar amortização", enabled: isOpen },
    { key: "fee", label: "Registrar tarifa", enabled: true },
    { key: "tax", label: "Registrar imposto", enabled: true },
    { key: "valuation", label: "Registrar avaliação", enabled: isOpen },
    { key: "metadata", label: "Editar rótulo", enabled: true },
  ]

  return (
    <section
      aria-label="Detalhe da posição"
      className="flex min-w-0 flex-col gap-4"
    >
      {positionQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>
            Dados anteriores; atualização da posição falhou
          </AlertTitle>
          <AlertDescription>
            <Button
              variant="outline"
              onClick={() => void positionQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="break-words">
            {position.instrumentName}
            {position.label ? ` — ${position.label}` : ""}
          </CardTitle>
          <Badge variant={isOpen ? "outline" : "secondary"}>
            {isOpen ? "Aberta" : "Encerrada"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Carteira</dt>
              <dd>{account?.name ?? "Carregando carteira"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Classe</dt>
              <dd>{classNames[position.assetClass] ?? position.assetClass}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modo de quantidade</dt>
              <dd>
                {position.quantityMode === "UNITS"
                  ? "Unidades"
                  : position.quantityMode === "AMOUNT"
                    ? "Valor"
                    : "Desconhecido"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quantidade</dt>
              <dd>{position.quantity ?? "Desconhecida"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Custo</dt>
              <dd>{money(position.bookCostMinor)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor atual</dt>
              <dd>{money(position.valuation.currentValueMinor)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Base do valor</dt>
              <dd>
                {position.valuation.basis === "CLOSED"
                  ? "Posição encerrada"
                  : position.valuation.basis === "BOOK_COST"
                    ? "Sem avaliação atual; usando custo"
                    : `Avaliação de ${formatDate(position.valuation.valuedAt!)}`}
              </dd>
            </div>
            {position.openedOn && (
              <div>
                <dt className="text-muted-foreground">Abertura</dt>
                <dd>{formatDate(position.openedOn)}</dd>
              </div>
            )}
            {position.closedOn && (
              <div>
                <dt className="text-muted-foreground">Encerramento</dt>
                <dd>{formatDate(position.closedOn)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Líquido</dt>
              <dd>
                {position.valuation.netValueMinor === undefined
                  ? "Desconhecido"
                  : money(position.valuation.netValueMinor)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resgatável</dt>
              <dd>
                {position.valuation.withdrawableValueMinor === undefined
                  ? "Desconhecido"
                  : money(position.valuation.withdrawableValueMinor)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Termos da posição</CardTitle>
        </CardHeader>
        <CardContent>
          {knownTerms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum termo adicional foi informado.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {knownTerms.map((term) => (
                <div key={term.label}>
                  <dt className="text-muted-foreground">{term.label}</dt>
                  <dd>{term.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Os termos da contratação não são alterados por operações
            posteriores.
          </p>
        </CardContent>
      </Card>
      {archived && (
        <Alert>
          <AlertTitle>Cadastro arquivado</AlertTitle>
          <AlertDescription>
            Reative a carteira e o instrumento antes de registrar operações ou
            corrigir uma saída que reabra a posição.
          </AlertDescription>
        </Alert>
      )}
      {(accountsQuery.isError || instrumentsQuery.isError) && (
        <ErrorState
          variant="load-error"
          title="Não foi possível verificar os cadastros da posição"
          actionLabel="Tentar novamente"
          onAction={() => {
            void accountsQuery.refetch()
            void instrumentsQuery.refetch()
          }}
        />
      )}
      <div aria-label="Ações da posição" className="flex flex-wrap gap-2">
        {actions
          .filter((action) => action.enabled)
          .map((action) => (
            <Button
              key={action.key}
              variant="outline"
              disabled={!canAct}
              onClick={() => onAction(action.key, position)}
            >
              {action.label}
            </Button>
          ))}
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList aria-label="Históricos da posição">
          <TabsTab value="operations">Operações</TabsTab>
          <TabsTab value="valuations">Avaliações</TabsTab>
        </TabsList>
        <TabsPanel value="operations">
          {tab === "operations" && (
            <InvestmentOperationHistory
              positionId={position.id}
              canCorrect={canAct}
              onCorrect={onCorrect}
            />
          )}
        </TabsPanel>
        <TabsPanel value="valuations">
          {tab === "valuations" && (
            <InvestmentValuationHistory
              position={position}
              canRecord={canAct && isOpen}
              onRecord={(selected) => onAction("valuation", selected)}
            />
          )}
        </TabsPanel>
      </Tabs>
    </section>
  )
}
