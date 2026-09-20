import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type {
  InvestmentMutationResult,
  InvestmentRequestReceipt,
} from "@workspace/application"
import { useActiveBook, useMyFin } from "../../../providers/index.js"
import { refreshTransactionProjections } from "../../query-invalidation.js"
import { invalidateInvestmentQueries } from "./investment-queries.js"

type ApplicationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown }

export class InvestmentSubmissionInFlightError extends Error {
  public constructor() {
    super("Um investimento já está sendo enviado.")
    this.name = "InvestmentSubmissionInFlightError"
  }
}

export class InvestmentSubmissionBookError extends Error {
  public constructor() {
    super("Um livro ativo é necessário para salvar o investimento.")
    this.name = "InvestmentSubmissionBookError"
  }
}

function defaultRequestId(): string {
  return globalThis.crypto.randomUUID()
}

function receiptResult(receipt: InvestmentRequestReceipt): InvestmentMutationResult {
  return receipt.result
}

export function useInvestmentSubmission<TDraft>(input: {
  readonly intentKey: string
  readonly execute: (command: {
    readonly bookId: string
    readonly requestId: string
    readonly draft: TDraft
  }) => Promise<ApplicationResult<InvestmentMutationResult>>
  readonly createRequestId?: () => string
}) {
  const services = useMyFin()
  const queryClient = useQueryClient()
  const { session } = useActiveBook()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const createRequestId = input.createRequestId ?? defaultRequestId
  const intent = useRef<{ key: string; requestId: string } | null>(null)
  const inFlight = useRef(false)
  const currentBookId = useRef(activeBookId)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<unknown>(undefined)

  if (intent.current === null || intent.current.key !== input.intentKey)
    intent.current = { key: input.intentKey, requestId: createRequestId() }
  const currentIntent = intent.current

  useEffect(() => {
    currentBookId.current = activeBookId
  }, [activeBookId])

  const submit = useCallback(
    async (draft: TDraft): Promise<InvestmentMutationResult> => {
      if (inFlight.current) throw new InvestmentSubmissionInFlightError()
      if (activeBookId === null) throw new InvestmentSubmissionBookError()

      const bookId = activeBookId
      const requestId = currentIntent.requestId
      inFlight.current = true
      setIsPending(true)
      setError(undefined)
      try {
        const result = await input.execute({ bookId, requestId, draft })
        const value = result.ok
          ? result.value
          : await services.investments.requests
              .get({ bookId, requestId })
              .then((receipt) => {
                if (receipt === null) throw result.error
                return receiptResult(receipt)
              })

        await Promise.all([
          invalidateInvestmentQueries(queryClient, bookId),
          refreshTransactionProjections(queryClient, {
            bookId,
            accountIds: [],
          }),
        ])
        return value
      } catch (cause) {
        setError(cause)
        throw cause
      } finally {
        inFlight.current = false
        if (currentBookId.current === bookId) setIsPending(false)
      }
    },
    [activeBookId, currentIntent, input.execute, queryClient, services.investments.requests]
  )

  return {
    submit,
    requestId: currentIntent.requestId,
    isPending,
    error,
    isBookCurrent: activeBookId !== null && currentBookId.current === activeBookId,
  }
}
