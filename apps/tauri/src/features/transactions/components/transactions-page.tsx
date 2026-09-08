import type { JournalChainListItem } from "@workspace/application"
import { useMemo, useState } from "react"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { filterTransactionChainsByStatus } from "../transaction-list-model.js"
import { useTransactionChains } from "../hooks/use-transaction-chains.js"
import { useTransactionFormOptions } from "../hooks/use-transaction-form-options.js"
import {
  emptyTransactionFilters,
  TransactionFilters,
} from "./transaction-filters.js"
import { TransactionSummary } from "./transaction-summary.js"
import { TransactionTable } from "./transaction-table.js"

function TransactionsPageContent({ bookId }: { readonly bookId: string }) {
  const [filters, setFilters] = useState(emptyTransactionFilters)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const chains = useTransactionChains(filters)
  const options = useTransactionFormOptions("INCOME")
  const items = useMemo(
    () =>
      filterTransactionChainsByStatus(chains.data?.items ?? [], filters.status),
    [chains.data?.items, filters.status]
  )
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
      <TransactionSummary items={items} />
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
      />
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
