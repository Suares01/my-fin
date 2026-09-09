import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@workspace/ui/components/toast"
import { transactionErrorMessage } from "../transaction-form-model"

const NOT_NOTIFIED = Symbol("not-notified")

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "OPTIMISTIC_CONCURRENCY_FAILURE"
  )
}

export function useTransactionFormSubmission<TDraft>({
  onSubmit,
  submitError,
  blocked,
  errorTitle = "Não foi possível salvar a transação",
  errorAction = "salvar",
}: {
  readonly onSubmit: (draft: TDraft) => Promise<void>
  readonly submitError?: unknown
  readonly blocked: boolean
  readonly errorTitle?: string
  readonly errorAction?: "salvar" | "cancelar"
}) {
  const [conflictLocked, setConflictLocked] = useState(false)
  const inFlight = useRef(false)
  const lastNotifiedError = useRef<unknown>(NOT_NOTIFIED)

  const notifyError = useCallback(
    (error: unknown) => {
      if (lastNotifiedError.current === error) return
      lastNotifiedError.current = error
      toast.add({
        type: "error",
        title: errorTitle,
        description: transactionErrorMessage(error, errorAction),
      })
    },
    [errorAction, errorTitle]
  )

  useEffect(() => {
    if (submitError !== undefined && submitError !== null)
      notifyError(submitError)
  }, [submitError, notifyError])

  async function submit(draft: TDraft) {
    if (blocked || conflictLocked || inFlight.current) return
    inFlight.current = true
    lastNotifiedError.current = NOT_NOTIFIED
    try {
      await onSubmit(draft)
    } catch (error) {
      notifyError(error)
      // A retained mutation error from a previous session must not lock a new form.
      if (isConflict(error)) setConflictLocked(true)
    } finally {
      inFlight.current = false
    }
  }

  return { submit, conflictLocked }
}
