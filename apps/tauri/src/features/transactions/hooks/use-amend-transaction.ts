import { useQueryClient } from "@tanstack/react-query"
import type {
  AmendJournalEntryResult,
  JournalBusinessDraft,
  JournalChainDetail,
} from "@workspace/application"
import { useRef } from "react"
import { affectedAccountIds } from "../transaction-form-model.js"
import { transactionKeys } from "./transaction-keys.js"
import { useMyFin } from "../../../providers/index.js"
import { useTransactionMutation } from "./transaction-mutation.js"

type CategorizedReplacement = Omit<
  Extract<JournalBusinessDraft, { readonly type: "INCOME" | "EXPENSE" }>,
  "type"
> & { readonly type: "INCOME" | "EXPENSE" }

export type AmendTransactionInput = {
  readonly bookId: string
  readonly chainId: string
  readonly presentedEntryId: string
  readonly presentedVersion: number
  readonly replacement:
    | CategorizedReplacement
    | Extract<JournalBusinessDraft, { readonly type: "TRANSFER" }>
  readonly previousDetail: JournalChainDetail
}

export class TransactionConflictLockedError extends Error {
  constructor() {
    super("Este lançamento mudou. Atualize os dados antes de tentar novamente.")
    this.name = "TransactionConflictLockedError"
  }
}

function isOptimisticConcurrencyFailure(error: Error): boolean {
  return (
    "code" in error &&
    (error as { readonly code?: unknown }).code ===
      "OPTIMISTIC_CONCURRENCY_FAILURE"
  )
}

export function useAmendTransaction() {
  const services = useMyFin()
  const queryClient = useQueryClient()
  const conflictLocked = useRef(false)

  return useTransactionMutation<AmendTransactionInput, AmendJournalEntryResult>(
    {
      execute: async (input) => {
        if (conflictLocked.current) throw new TransactionConflictLockedError()
        const result = await services.journal.amend.execute({
          bookId: input.bookId,
          journalEntryId: input.presentedEntryId,
          expectedVersion: input.presentedVersion,
          replacement: input.replacement,
        })
        if (!result.ok && isOptimisticConcurrencyFailure(result.error)) {
          conflictLocked.current = true
          try {
            await Promise.all([
              queryClient.refetchQueries({
                queryKey: transactionKeys.lists(input.bookId),
                exact: false,
              }),
              queryClient.refetchQueries({
                queryKey: transactionKeys.detail(input.bookId, input.chainId),
                exact: true,
              }),
            ])
          } finally {
            conflictLocked.current = false
          }
        }
        return result
      },
      refresh: (input) => ({
        bookId: input.bookId,
        chainId: input.chainId,
        accountIds: affectedAccountIds(input.replacement, input.previousDetail),
      }),
    }
  )
}
