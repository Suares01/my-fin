import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import type { JournalChainListItem, QueryPage } from "@workspace/application"
import { useMemo, useRef } from "react"
import { useActiveBook, useMyFin } from "../../../providers/index.js"
import {
  dedupeTransactionChainPages,
  normalizeTransactionServerFilters,
  type TransactionFilters,
} from "../transaction-list-model.js"
import { transactionKeys } from "./transaction-keys.js"

const TRANSACTION_PAGE_SIZE = 20

export type TransactionChainsData = InfiniteData<
  QueryPage<JournalChainListItem>,
  string | undefined
> & {
  readonly items: readonly JournalChainListItem[]
  readonly nextCursor: string | null
}

function isInvalidCursor(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "INVALID_QUERY"
  )
}

export function useTransactionChains(filters: TransactionFilters) {
  const services = useMyFin()
  const queryClient = useQueryClient()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const normalizedFilters = useMemo(
    () => normalizeTransactionServerFilters(filters),
    [filters]
  )
  const recoveredCursors = useRef(new Set<string>())
  const scopedBookId = bookId ?? "unresolved"
  const queryKey = transactionKeys.list(scopedBookId, normalizedFilters)

  return useInfiniteQuery({
    queryKey,
    enabled: bookId !== null,
    initialPageParam: undefined as string | undefined,
    retry: false,
    queryFn: async ({ pageParam }) => {
      if (bookId === null) {
        throw new Error("Transaction chains require an active book")
      }

      const execute = async (cursor?: string) => {
        const result = await services.journal.listChains.execute({
          bookId,
          ...normalizedFilters,
          limit: TRANSACTION_PAGE_SIZE,
          ...(cursor === undefined ? {} : { cursor }),
        })
        if (!result.ok) throw result.error
        return result.value
      }

      try {
        return await execute(pageParam)
      } catch (error) {
        const recoveryKey = `${bookId}:${pageParam ?? "first"}`
        if (
          pageParam === undefined ||
          !isInvalidCursor(error) ||
          recoveredCursors.current.has(recoveryKey)
        ) {
          throw error
        }

        recoveredCursors.current.add(recoveryKey)
        queryClient.removeQueries({ queryKey })
        return execute()
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data): TransactionChainsData => ({
      ...data,
      items: dedupeTransactionChainPages(data.pages),
      nextCursor: data.pages.at(-1)?.nextCursor ?? null,
    }),
  })
}
