import type {
  JournalChainDetail,
  JournalChainListItem,
} from "@workspace/application"
import { useCallback, useDeferredValue, useMemo, useState } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { filterTransactionChainsByStatus } from "../transaction-list-model.js"
import { useTransactionChains } from "../hooks/use-transaction-chains.js"
import { useTransactionFormOptions } from "../hooks/use-transaction-form-options.js"
import { useTransactionChainDetail } from "../hooks/use-transaction-chain-detail.js"
import {
  emptyTransactionFilters,
  TransactionFilters,
} from "./transaction-filters.js"
import { TransactionSummary } from "./transaction-summary.js"
import { TransactionTable } from "./transaction-table.js"
import {
  TransactionOverlay,
  type TransactionOverlayState,
} from "./transaction-overlay.js"

type TransactionActionTarget = {
  readonly action: "edit" | "cancel"
  readonly transaction: JournalChainListItem
}

function overlayStateFor(
  action: TransactionActionTarget,
  detail: JournalChainDetail
): TransactionOverlayState {
  if (action.action === "cancel") return { kind: "delete", detail }

  switch (detail.type) {
    case "INCOME":
      return { kind: "income", detail }
    case "EXPENSE":
      return { kind: "expense", detail }
    case "TRANSFER":
      return { kind: "transfer", detail }
    case "OPENING_BALANCE":
      return { kind: "closed" }
  }
}

function TransactionsPageContent({ bookId }: { readonly bookId: string }) {
  const [filters, setFilters] = useState(emptyTransactionFilters)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionTarget, setActionTarget] = useState<TransactionActionTarget>()

  const deferredSearch = useDeferredValue(filters.search)
  const queryFilters = useMemo(
    () => ({ ...filters, search: deferredSearch }),
    [filters, deferredSearch]
  )
  const chains = useTransactionChains(queryFilters)
  const options = useTransactionFormOptions("INCOME")
  const detail = useTransactionChainDetail({
    chainId: actionTarget?.transaction.chainId,
    presentedEntryId: actionTarget?.transaction.presentedEntryId,
    enabled: actionTarget !== undefined,
  })
  const items = useMemo(
    () =>
      filterTransactionChainsByStatus(chains.data?.items ?? [], filters.status),
    [chains.data?.items, filters.status]
  )
  const closeAction = useCallback(() => setActionTarget(undefined), [])
  const openEdit = useCallback(
    (transaction: JournalChainListItem) =>
      setActionTarget({ action: "edit", transaction }),
    []
  )
  const openCancellation = useCallback(
    (transaction: JournalChainListItem) =>
      setActionTarget({ action: "cancel", transaction }),
    []
  )
  const handleOverlayStateChange = useCallback(
    (state: TransactionOverlayState) => {
      if (state.kind === "closed") closeAction()
    },
    [closeAction]
  )
  const overlayState =
    actionTarget !== undefined && detail.data !== undefined
      ? overlayStateFor(actionTarget, detail.data)
      : { kind: "closed" as const }

  return (
    <section key={bookId} className="motion-reveal flex w-full flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Livro ativo
          </p>
          <h1 className="font-display text-4xl font-normal tracking-tight">
            Transações
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e opere seu histórico financeiro.
          </p>
        </div>
      </header>
      <TransactionSummary filters={queryFilters} />
      <TransactionFilters
        filters={filters}
        accounts={options.accounts}
        categories={options.categories}
        onChange={setFilters}
        onReset={() => setFilters(emptyTransactionFilters)}
      />
      <TransactionTable
        transactions={items as JournalChainListItem[]}
        expandedId={expandedId}
        selectedIds={selectedIds}
        setExpandedId={setExpandedId}
        setSelectedIds={setSelectedIds}
        hasNextPage={chains.hasNextPage}
        isFetchingNextPage={chains.isFetchingNextPage}
        onLoadMore={() => void chains.fetchNextPage()}
        onEdit={openEdit}
        onCancel={openCancellation}
        actionPendingChainId={
          detail.isPending ? actionTarget?.transaction.chainId : undefined
        }
      />
      {actionTarget !== undefined && detail.isError && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível preparar a transação</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Atualize os detalhes antes de tentar editar ou cancelar o
            lançamento.
            <Button
              type="button"
              variant="outline"
              onClick={() => void detail.refetch()}
            >
              Tentar novamente
            </Button>
            <Button type="button" variant="ghost" onClick={closeAction}>
              Voltar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {overlayState.kind !== "closed" && (
        <TransactionOverlay
          bookId={bookId}
          state={overlayState}
          onStateChange={handleOverlayStateChange}
          onSuccess={closeAction}
        />
      )}
    </section>
  )
}

export function TransactionsPage() {
  const { session } = useActiveBook()

  if (session.status !== "ACTIVE")
    return (
      <section className="flex min-h-52 items-center justify-center">
        <p>Selecione um livro para consultar transações.</p>
      </section>
    )

  return (
    <TransactionsPageContent key={session.bookId} bookId={session.bookId} />
  )
}
