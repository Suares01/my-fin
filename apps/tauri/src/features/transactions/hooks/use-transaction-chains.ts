import { useQuery } from "@tanstack/react-query"
import type { JournalChainListItem } from "@workspace/application"
import { useMemo } from "react"
import { useActiveBook, useMyFin } from "../../../providers/index.js"
import {
  normalizeTransactionServerFilters,
  type TransactionFilters,
} from "../transaction-list-model.js"
import { transactionKeys } from "./transaction-keys.js"

export type TransactionChainsData = {
  readonly items: readonly JournalChainListItem[]
}

export function useTransactionChains(filters: TransactionFilters) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const normalizedFilters = useMemo(
    () => normalizeTransactionServerFilters(filters),
    [filters]
  )
  const scopedBookId = bookId ?? "unresolved"
  const queryKey = transactionKeys.list(scopedBookId, normalizedFilters)

  return useQuery({
    queryKey,
    enabled: bookId !== null,
    retry: false,
    queryFn: async () => {
      if (bookId === null) {
        throw new Error("Transaction chains require an active book")
      }

      const result = await services.journal.listChains.execute({
        bookId,
        ...normalizedFilters,
      })
      if (!result.ok) throw result.error
      return result.value
    },
    select: (items): TransactionChainsData => ({
      items,
    }),
  })
}
