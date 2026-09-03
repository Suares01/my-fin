import type { JournalChainDetail } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import {
  localCivilDate,
  validateCancellationDate,
  transactionErrorMessage,
} from "../transaction-form-model.js"

export type TransactionDeleteDialogProps = {
  readonly detail: JournalChainDetail
  readonly pending?: boolean
  readonly submitError?: unknown
  readonly onConfirm: (input: {
    readonly occurredOn: string
    readonly description: string
  }) => Promise<void>
  readonly onCancel: () => void
}

export function TransactionDeleteDialog({
  detail,
  pending = false,
  submitError,
  onConfirm,
  onCancel,
}: TransactionDeleteDialogProps) {
  const [occurredOn, setOccurredOn] = useState(localCivilDate)
  const [dateError, setDateError] = useState<string>()
  const [localError, setLocalError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)
  const [conflictLocked, setConflictLocked] = useState(false)
  const description = `Cancelamento de: ${detail.description}`
  const disabled = pending || submitting || conflictLocked
  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const validation = validateCancellationDate(occurredOn, detail.occurredOn)
    if (validation) {
      setDateError(validation)
      return
    }
    try {
      setDateError(undefined)
      setLocalError(null)
      setSubmitting(true)
      await onConfirm({ occurredOn, description })
    } catch (error) {
      setLocalError(error)
      if (isConflict(error)) setConflictLocked(true)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !disabled) onCancel()
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl"
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>Cancelar transação</SheetTitle>
          <SheetDescription>
            O efeito financeiro será cancelado, mas o histórico da transação
            será preservado.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-6 p-6"
          onSubmit={confirm}
          aria-busy={disabled}
        >
          {submitError !== undefined || localError !== null ? (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível cancelar a transação</AlertTitle>
              <AlertDescription>
                {transactionErrorMessage(submitError ?? localError)}
              </AlertDescription>
            </Alert>
          ) : null}
          {conflictLocked && (
            <Alert variant="destructive">
              <AlertTitle>Este lançamento mudou</AlertTitle>
              <AlertDescription>
                Atualize os dados antes de tentar novamente.
              </AlertDescription>
            </Alert>
          )}
          <Field data-invalid={dateError ? "true" : undefined}>
            <FieldLabel htmlFor="transaction-cancellation-date">
              Data de cancelamento
            </FieldLabel>
            <Input
              id="transaction-cancellation-date"
              type="date"
              value={occurredOn}
              disabled={disabled}
              aria-invalid={Boolean(dateError)}
              aria-describedby="transaction-cancellation-date-description transaction-cancellation-date-error"
              onChange={(event) => setOccurredOn(event.currentTarget.value)}
            />
            <FieldDescription id="transaction-cancellation-date-description">
              Você pode ajustar a data do cancelamento.
            </FieldDescription>
            <FieldError id="transaction-cancellation-date-error">
              {dateError}
            </FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="transaction-cancellation-description">
              Descrição do cancelamento
            </FieldLabel>
            <Input
              id="transaction-cancellation-description"
              value={description}
              readOnly
              aria-describedby="transaction-cancellation-description-help"
            />
            <FieldDescription id="transaction-cancellation-description-help">
              A descrição é gerada para manter o vínculo com a transação
              original.
            </FieldDescription>
          </Field>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={onCancel}
            >
              Voltar
            </Button>
            <Button type="submit" variant="destructive" disabled={disabled}>
              {disabled && (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              )}
              {disabled ? "Cancelando transação" : "Confirmar cancelamento"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "OPTIMISTIC_CONCURRENCY_FAILURE"
  )
}
