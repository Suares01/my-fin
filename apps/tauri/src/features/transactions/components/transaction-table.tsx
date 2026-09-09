import { AnimatePresence, motion } from "motion/react"
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Undo2Icon,
} from "lucide-react"
import { JournalChainListItem } from "@workspace/application"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Badge } from "@workspace/ui/components/badge"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { cn } from "@workspace/ui/lib/utils"
import { FormattedMoney } from "@workspace/ui/money"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useState } from "react"
import {
  transactionAmountSign,
  type TransactionStatusFilter,
  type TransactionType,
} from "../transaction-list-model.js"
import { TransactionRowDetails } from "./transaction-row-details.js"
import { format } from "date-fns"

interface TransactionTableProps {
  transactions: readonly JournalChainListItem[]
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  onEdit?: (transaction: JournalChainListItem) => void
  onCancel?: (transaction: JournalChainListItem) => void
  actionPendingChainId?: string
}

function statusBadge(status: JournalChainListItem["status"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="default">Ativa</Badge>
    case "EDITED":
      return (
        <Badge variant="outline" className="text-amber-500 dark:text-amber-400">
          Editada
        </Badge>
      )
    case "CANCELLED":
      return <Badge variant="destructive">Cancelada</Badge>
  }
}

export function TransactionTable({
  transactions,
  selectedIds,
  setSelectedIds,
  expandedId,
  setExpandedId,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onEdit,
  onCancel,
  actionPendingChainId,
}: TransactionTableProps) {
  const allSelected =
    transactions.length > 0 &&
    transactions.every((t) => selectedIds.has(t.chainId))

  const someSelected =
    transactions.some((t) => selectedIds.has(t.chainId)) && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.chainId)))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    className="size-4 cursor-pointer rounded accent-primary"
                  />
                </TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Transaction ID
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState variant="filter" className="py-12" />
                  </TableCell>
                </TableRow>
              )}

              {transactions.map((tx) => {
                const isExpanded = expandedId === tx.chainId
                return (
                  <TransactionRow
                    key={tx.chainId}
                    tx={tx}
                    isSelected={selectedIds.has(tx.chainId)}
                    isExpanded={isExpanded}
                    onToggleSelect={() => toggleOne(tx.chainId)}
                    onToggleExpand={() =>
                      setExpandedId(isExpanded ? null : tx.chainId)
                    }
                    onEdit={onEdit}
                    onCancel={onCancel}
                    actionPending={actionPendingChainId === tx.chainId}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      {hasNextPage && onLoadMore !== undefined && (
        <Button
          type="button"
          variant="outline"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage
            ? "Carregando mais resultados"
            : "Carregar mais resultados"}
        </Button>
      )}
    </div>
  )
}

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

/** Compatibility export for the paginated transaction-list contract. */
export function TransactionList({
  items,
  status,
  isPending = false,
  isError = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onRetry,
  onLoadMore,
  onResetFilters,
  onCreate,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const [expandedChainId, setExpandedChainId] = useState<string>()

  if (isPending) {
    return (
      <div
        className="grid gap-3"
        aria-busy="true"
        aria-label="Carregando transações"
      >
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 p-6">
        <p>Não foi possível carregar as transações.</p>
        <Button type="button" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    const filtered = status !== "ALL"
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p>
          {filtered
            ? "Nenhum resultado corresponde aos filtros."
            : "Você ainda não tem transações."}
        </p>
        <Button
          type="button"
          className="mt-3 w-full sm:w-auto"
          onClick={filtered ? onResetFilters : onCreate}
        >
          {filtered ? "Limpar filtros" : "Nova transação"}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:hidden" aria-label="Lista de transações">
        {items.map((item) => (
          <article key={item.chainId} className="rounded-xl border p-4">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-sm text-muted-foreground">
                  {item.type} · {item.occurredOn} · {item.status}
                </p>
              </div>
              <span>
                {transactionAmountSign(item.type as TransactionType)}
                <FormattedMoney
                  amountMinor={item.amountMinor}
                  currency={item.currency}
                />
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              aria-expanded={expandedChainId === item.chainId}
              onClick={() =>
                setExpandedChainId(
                  expandedChainId === item.chainId ? undefined : item.chainId
                )
              }
            >
              Ver detalhes
            </Button>
            {expandedChainId === item.chainId && (
              <TransactionRowDetails
                chainId={item.chainId}
                presentedEntryId={item.presentedEntryId}
                status={item.status}
                onEdit={() => onEdit(item.chainId)}
                onDelete={() => onDelete(item.chainId)}
              />
            )}
          </article>
        ))}
      </div>
      <table className="hidden w-full text-left lg:table">
        <thead>
          <tr>
            <th>Contexto</th>
            <th>Valor</th>
            <th>Data</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.chainId}>
              <td>{item.description}</td>
              <td>
                {transactionAmountSign(item.type as TransactionType)}
                <FormattedMoney
                  amountMinor={item.amountMinor}
                  currency={item.currency}
                />
              </td>
              <td>{item.occurredOn}</td>
              <td>{item.status}</td>
              <td>
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={expandedChainId === item.chainId}
                  onClick={() =>
                    setExpandedChainId(
                      expandedChainId === item.chainId
                        ? undefined
                        : item.chainId
                    )
                  }
                >
                  Ver detalhes
                </Button>
                {expandedChainId === item.chainId && (
                  <TransactionRowDetails
                    chainId={item.chainId}
                    presentedEntryId={item.presentedEntryId}
                    status={item.status}
                    onEdit={() => onEdit(item.chainId)}
                    onDelete={() => onDelete(item.chainId)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage
            ? "Carregando mais resultados"
            : "Carregar mais resultados"}
        </Button>
      )}
    </div>
  )
}

function TransactionRow({
  tx,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onCancel,
  actionPending,
}: {
  tx: JournalChainListItem
  isSelected: boolean
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onEdit?: (transaction: JournalChainListItem) => void
  onCancel?: (transaction: JournalChainListItem) => void
  actionPending: boolean
}) {
  const canOperate =
    (tx.status === "ACTIVE" || tx.status === "EDITED") &&
    onEdit !== undefined &&
    onCancel !== undefined

  return (
    <>
      <TableRow
        className={cn(
          "group cursor-pointer",
          isSelected && "bg-muted/50",
          isExpanded && "border-b-0"
        )}
        onClick={onToggleExpand}
      >
        <TableCell className="pl-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="size-4 cursor-pointer rounded accent-primary"
          />
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{tx.description}</p>
              {tx.categories[0] && (
                <Badge variant="secondary" className="mt-0.5 text-[10px]">
                  {tx.categories[0].name}
                </Badge>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="hidden sm:table-cell">
          <span className="font-mono text-xs text-muted-foreground">
            {tx.chainId}
          </span>
        </TableCell>

        <TableCell className="text-right">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              tx.type === "INCOME" ? "text-emerald-500" : "text-foreground"
            )}
          >
            {tx.type === "INCOME" ? "+" : "-"}
            <FormattedMoney
              amountMinor={BigInt(tx.amountMinor).toString()}
              currency="BRL"
            />
          </span>
        </TableCell>

        <TableCell className="hidden md:table-cell">
          <span className="text-sm text-muted-foreground">
            {format(tx.occurredOn, "dd/MM/yyyy")}
          </span>
        </TableCell>

        <TableCell className="hidden lg:table-cell">
          {statusBadge(tx.status)}
        </TableCell>

        <TableCell>
          {canOperate && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Ações para ${tx.description}`}
                    title={`Ações para ${tx.description}`}
                    disabled={actionPending}
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(tx)
                    }}
                  >
                    <PencilIcon />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    variant="destructive"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCancel(tx)
                    }}
                  >
                    <Undo2Icon />
                    Cancelar
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <tr>
            <td colSpan={7} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-4 border-b bg-muted/30 px-4 py-3 pl-12 text-sm">
                  {/* {tx.merchantInfo && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                      <span>{tx.merchantInfo}</span>
                    </div>
                  )} */}

                  {/* {tx.cardLast4 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCardIcon className="size-3.5 shrink-0" />
                      <span className="tabular-nums">
                        Paid with card ending ****{tx.cardLast4}
                      </span>
                    </div>
                  )} */}

                  {/* {tx.notes && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <StickyNoteIcon className="mt-0.5 size-3.5 shrink-0" />
                      <span>{tx.notes}</span>
                    </div>
                  )} */}

                  <Button variant="ghost" size="xs" className="ml-auto">
                    <FileTextIcon className="size-3.5" />
                    View Receipt
                  </Button>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}
