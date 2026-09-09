import { useQuery } from "@tanstack/react-query"
import type { JournalChainSummary } from "@workspace/application"
import { useMemo } from "react"
import { useActiveBook, useMyFin } from "../../../providers/index.js"
import {
  normalizeTransactionSummaryFilters,
  type TransactionFilters,
} from "../transaction-list-model.js"
import { transactionKeys } from "./transaction-keys.js"

export function useTransactionSummary(filters: TransactionFilters) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const normalizedFilters = useMemo(
    () => normalizeTransactionSummaryFilters(filters),
    [filters]
  )
  const scopedBookId = bookId ?? "unresolved"

  return useQuery<JournalChainSummary>({
    queryKey: transactionKeys.summary(scopedBookId, normalizedFilters),
    enabled: bookId !== null,
    retry: false,
    queryFn: async () => {
      if (bookId === null) {
        throw new Error("Transaction summary requires an active book")
      }
      const result = await services.journal.summary.execute({
        bookId,
        ...normalizedFilters,
      })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
