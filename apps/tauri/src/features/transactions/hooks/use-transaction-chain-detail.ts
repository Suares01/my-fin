import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { JournalChainDetail } from "@workspace/application"
import { useEffect, useRef } from "react"
import { useActiveBook, useMyFin } from "../../../providers/index.js"
import { transactionKeys } from "./transaction-keys.js"

export type TransactionChainDetailRequest = {
  readonly chainId: string | undefined
  readonly presentedEntryId: string | undefined
  readonly enabled: boolean
}

export function useTransactionChainDetail({
  chainId,
  presentedEntryId,
  enabled,
}: TransactionChainDetailRequest) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const scopedBookId = bookId ?? "unresolved"
  const scopedChainId = chainId ?? "unresolved"
  const previousPresentedEntryId = useRef(presentedEntryId)
  const latestPresentedEntryId = useRef(presentedEntryId)
  latestPresentedEntryId.current = presentedEntryId
  const queryClient = useQueryClient()

  useEffect(() => {
    if (previousPresentedEntryId.current === presentedEntryId) return
    previousPresentedEntryId.current = presentedEntryId
    if (!enabled || bookId === null || chainId === undefined || presentedEntryId === undefined) return
    void queryClient.invalidateQueries({
      queryKey: transactionKeys.detail(bookId, chainId),
    })
  }, [bookId, chainId, enabled, presentedEntryId, queryClient])

  return useQuery<JournalChainDetail>({
    queryKey: transactionKeys.detail(scopedBookId, scopedChainId),
    enabled:
      enabled && bookId !== null && chainId !== undefined && presentedEntryId !== undefined,
    retry: false,
    queryFn: async () => {
      const entryId = latestPresentedEntryId.current
      if (bookId === null || entryId === undefined) {
        throw new Error("Transaction chain detail requires an active book and entry")
      }
      const result = await services.journal.getChain.execute({
        bookId,
        entryId,
      })
      if (!result.ok) throw result.error
      if (result.value === null) throw new Error("Transaction chain detail was not found")
      return result.value
    },
  })
}
