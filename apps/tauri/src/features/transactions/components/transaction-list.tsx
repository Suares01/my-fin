import type { JournalChainListItem } from "@workspace/application"
import { Button } from "@workspace/ui/components/button"
import { FormattedMoney } from "@workspace/ui/money"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useState } from "react"
import { transactionAmountSign, type TransactionStatusFilter, type TransactionType } from "../transaction-list-model.js"
import { TransactionRowDetails } from "./transaction-row-details.js"

type TransactionListProps = {
  readonly items: readonly JournalChainListItem[]
  readonly status: TransactionStatusFilter
  readonly isPending?: boolean
  readonly isError?: boolean
  readonly hasNextPage?: boolean
  readonly isFetchingNextPage?: boolean
  readonly onRetry: () => void
  readonly onLoadMore: () => void
  readonly onResetFilters: () => void
  readonly onCreate: () => void
  readonly onEdit: (chainId: string) => void
  readonly onDelete: (chainId: string) => void
}

function ChainValue({ item }: { readonly item: JournalChainListItem }) {
  return <span>{transactionAmountSign(item.type as TransactionType)}<FormattedMoney amountMinor={item.amountMinor} currency={item.currency} /></span>
}

export function TransactionList({ items, status, isPending = false, isError = false, hasNextPage = false, isFetchingNextPage = false, onRetry, onLoadMore, onResetFilters, onCreate, onEdit, onDelete }: TransactionListProps) {
  const [expandedChainId, setExpandedChainId] = useState<string>()
  if (isPending) return <div className="grid gap-3" aria-busy="true" aria-label="Carregando transações"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
  if (isError) return <div role="alert" className="rounded-xl border border-destructive/30 p-6"><p>Não foi possível carregar as transações.</p><Button type="button" onClick={onRetry}>Tentar novamente</Button></div>
  if (items.length === 0) return <div className="rounded-xl border border-dashed p-6 text-center"><p>{status === "ALL" ? "Você ainda não tem transações." : "Nenhum resultado corresponde aos filtros."}</p><Button type="button" className="mt-3 w-full sm:w-auto" onClick={status === "ALL" ? onCreate : onResetFilters}>{status === "ALL" ? "Nova transação" : "Limpar filtros"}</Button></div>
  return <div className="grid gap-3">
    <div className="grid gap-3 lg:hidden" aria-label="Lista de transações">
      {items.map((item) => <article key={item.chainId} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-medium">{item.description}</p><p className="text-sm text-muted-foreground">{item.type} · {item.occurredOn} · {item.status}</p></div><ChainValue item={item} /></div><Button type="button" variant="outline" className="mt-3 w-full" aria-expanded={expandedChainId === item.chainId} onClick={() => setExpandedChainId(expandedChainId === item.chainId ? undefined : item.chainId)}>Ver detalhes</Button>{expandedChainId === item.chainId && <TransactionRowDetails chainId={item.chainId} presentedEntryId={item.presentedEntryId} status={item.status} onEdit={() => onEdit(item.chainId)} onDelete={() => onDelete(item.chainId)} />}</article>)}
    </div>
    <table className="hidden w-full text-left lg:table"><thead><tr><th>Contexto</th><th>Valor</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.chainId}><td>{item.description}</td><td><ChainValue item={item} /></td><td>{item.occurredOn}</td><td>{item.status}</td><td><Button type="button" variant="outline" aria-expanded={expandedChainId === item.chainId} onClick={() => setExpandedChainId(expandedChainId === item.chainId ? undefined : item.chainId)}>Ver detalhes</Button>{expandedChainId === item.chainId && <TransactionRowDetails chainId={item.chainId} presentedEntryId={item.presentedEntryId} status={item.status} onEdit={() => onEdit(item.chainId)} onDelete={() => onDelete(item.chainId)} />}</td></tr>)}</tbody></table>
    {hasNextPage && <Button type="button" variant="outline" disabled={isFetchingNextPage} onClick={onLoadMore}>{isFetchingNextPage ? "Carregando mais resultados" : "Carregar mais resultados"}</Button>}
  </div>
}
