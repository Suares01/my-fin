import { useQueryClient } from "@tanstack/react-query"
import type {
  JournalChainDetail,
  JournalEntryDto,
} from "@workspace/application"
import { useRef } from "react"
import { validateCancellationDate } from "../transaction-form-model.js"
import { useMyFin } from "../../../providers/index.js"
import { transactionKeys } from "./transaction-keys.js"
import { useTransactionMutation } from "./transaction-mutation.js"

export type ReverseTransactionInput = {
  readonly bookId: string
  readonly chainId: string
  readonly presentedEntryId: string
  readonly presentedVersion: number
  readonly presentedOccurredOn: string
  readonly occurredOn: string
  readonly description: string
  readonly previousDetail: JournalChainDetail
}

export class InvalidCancellationDateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidCancellationDateError"
  }
}

function isOptimisticConcurrencyFailure(error: Error): boolean {
  return (
    "code" in error &&
    (error as { readonly code?: unknown }).code ===
      "OPTIMISTIC_CONCURRENCY_FAILURE"
  )
}

export function useReverseTransaction() {
  const services = useMyFin()
  const queryClient = useQueryClient()
  const conflictLocked = useRef(false)

  return useTransactionMutation<ReverseTransactionInput, JournalEntryDto>({
    execute: async (input) => {
      if (conflictLocked.current)
        throw new Error(
          "Este lançamento mudou. Atualize os dados antes de tentar novamente."
        )
      const validationError = validateCancellationDate(
        input.occurredOn,
        input.presentedOccurredOn
      )
      if (validationError !== undefined)
        throw new InvalidCancellationDateError(validationError)
      const result = await services.journal.reverse.execute({
        bookId: input.bookId,
        journalEntryId: input.presentedEntryId,
        expectedVersion: input.presentedVersion,
        occurredOn: input.occurredOn,
        description: input.description,
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
      accountIds: input.previousDetail.financialAccounts.map(
        (account) => account.id
      ),
    }),
  })
}
