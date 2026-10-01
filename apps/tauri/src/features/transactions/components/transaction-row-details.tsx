import type {
  JournalChainDetail,
  JournalChainStatus,
} from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { FormattedMoney } from "@workspace/ui/money"
import { Link } from "react-router"
import { useTransactionChainDetail } from "../hooks/use-transaction-chain-detail.js"

export type TransactionRowDetailsProps = {
  readonly chainId: string
  readonly presentedEntryId: string
  readonly status: JournalChainStatus
  readonly onEdit?: (detail: JournalChainDetail) => void
  readonly onDelete?: (detail: JournalChainDetail) => void
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

export function TransactionRowDetails({
  chainId,
  presentedEntryId,
  status,
  onEdit,
  onDelete,
}: TransactionRowDetailsProps) {
  const query = useTransactionChainDetail({
    chainId,
    presentedEntryId,
    enabled: true,
  })

  if (query.isPending)
    return (
      <Skeleton
        className="h-28 w-full"
        aria-label="Carregando detalhes da transação"
      />
    )
  if (query.isError || query.data === undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar os detalhes</AlertTitle>
        <AlertDescription>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const detail = query.data
  const editable =
    (status === "ACTIVE" || status === "EDITED") &&
    detail.type !== "INVESTMENT" &&
    detail.canEditWithGenericFlow &&
    onEdit !== undefined &&
    onDelete !== undefined
  const investment =
    detail.type === "INVESTMENT" ? detail.investment : undefined
  const investmentCategories = investment
    ? detail.postings.filter(
        (posting) =>
          posting.account.kind === "INCOME" ||
          posting.account.kind === "EXPENSE"
      )
    : []

  return (
    <div
      className="grid gap-4 rounded-lg bg-muted/30 p-4"
      aria-label="Detalhes da transação"
    >
      {investment && (
        <section aria-label="Operação de investimento" className="grid gap-2">
          <p>
            <span className="font-medium">Operação:</span>{" "}
            {operationLabels[investment.operationType] ??
              investment.operationType}
          </p>
          <p>
            <span className="font-medium">Valor bruto:</span>{" "}
            <FormattedMoney
              amountMinor={investment.grossAmountMinor}
              currency={detail.currency}
            />
          </p>
          <p>
            <span className="font-medium">Variação do custo:</span>{" "}
            <FormattedMoney
              amountMinor={investment.bookCostDeltaMinor}
              currency={detail.currency}
            />
          </p>
          <p>
            <span className="font-medium">Fluxo líquido:</span>{" "}
            <FormattedMoney
              amountMinor={investment.netCashFlowMinor}
              currency={detail.currency}
            />
          </p>
          {investmentCategories.length > 0 && (
            <ul aria-label="Receitas e despesas da operação">
              {investmentCategories.map((posting) => (
                <li key={posting.id}>
                  {posting.account.kind === "INCOME" ? "Receita" : "Despesa"}:{" "}
                  {posting.account.name}{" "}
                  <FormattedMoney
                    amountMinor={posting.amountMinor.replace(/^-/, "")}
                    currency={posting.currency}
                  />
                </li>
              ))}
            </ul>
          )}
          <Link
            className="text-primary underline-offset-4 hover:underline focus-visible:underline"
            to={`/investments/positions/${encodeURIComponent(investment.positionId)}`}
          >
            Ver operação de investimento
          </Link>
        </section>
      )}
      {detail.type === "TRANSFER" && detail.transfer ? (
        <p>
          <span className="font-medium">Transferência:</span>{" "}
          {detail.transfer.source.name} → {detail.transfer.destination.name}
        </p>
      ) : (
        <div className="grid gap-1">
          <p>
            <span className="font-medium">Conta:</span>{" "}
            {detail.financialAccounts.map((account) => account.name).join(", ")}
          </p>
          <p>
            <span className="font-medium">Categoria:</span>{" "}
            {detail.categories.map((category) => category.name).join(", ")}
          </p>
        </div>
      )}
      <section aria-label="Histórico da cadeia">
        <h3 className="font-medium">Histórico</h3>
        <ol className="mt-2 grid gap-1 text-sm">
          {detail.history.map((item) => (
            <li key={item.entryId}>
              {item.role}: {item.description} em {item.occurredOn}
            </li>
          ))}
        </ol>
      </section>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onEdit(detail)}>
            Editar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onDelete(detail)}
          >
            Cancelar lançamento
          </Button>
        </div>
      )}
    </div>
  )
}
