import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import {
  refreshTransactionProjections,
  type ProjectionRefreshOutcome,
} from "../../query-invalidation.js"

export class TransactionMutationInFlightError extends Error {
  constructor() {
    super("Uma transação já está sendo enviada.")
    this.name = "TransactionMutationInFlightError"
  }
}

type ApplicationResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: Error }

export type TransactionMutationResult<TValue> = {
  readonly value: TValue
  readonly refresh: ProjectionRefreshOutcome
}

export type TransactionMutationRefresh = {
  readonly bookId: string
  readonly chainId?: string
  readonly accountIds: readonly string[]
}

export function useTransactionMutation<
  TVariables extends { readonly bookId: string },
  TValue,
>(input: {
  readonly execute: (
    variables: TVariables
  ) => Promise<ApplicationResult<TValue>>
  readonly refresh: (
    variables: TVariables,
    value: TValue
  ) => TransactionMutationRefresh
}) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)

  return useMutation<TransactionMutationResult<TValue>, Error, TVariables>({
    retry: false,
    mutationFn: async (variables) => {
      if (inFlight.current) throw new TransactionMutationInFlightError()
      inFlight.current = true

      try {
        const result = await input.execute(variables)
        if (!result.ok) throw result.error

        return {
          value: result.value,
          refresh: await refreshTransactionProjections(
            queryClient,
            input.refresh(variables, result.value)
          ),
        }
      } finally {
        inFlight.current = false
      }
    },
  })
}
