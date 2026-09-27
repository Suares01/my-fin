import type {
  InvestmentMutationResult,
  InvestmentOperationHistoryItem,
  InvestmentPositionView,
} from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { useState } from "react"
import { useActiveBook, useMyFin } from "../../../providers"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import { InvestmentAmortizationForm } from "./investment-amortization-form"
import {
  correctableOperation,
  correctionErrorMessage,
  correctionPosition,
} from "./investment-correction-form-model"
import { InvestmentExpenseForm } from "./investment-expense-form"
import { InvestmentIncomeForm } from "./investment-income-form"
import { InvestmentPurchaseForm } from "./investment-purchase-form"
import { InvestmentSaleForm } from "./investment-sale-form"

type Props = {
  readonly position: InvestmentPositionView
  readonly operation: InvestmentOperationHistoryItem
  readonly lastEffectiveOperationId: string
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

export function InvestmentCorrectionForm({
  position,
  operation,
  lastEffectiveOperationId,
  onSuccess,
  onCancel,
}: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const [action, setAction] = useState<"CANCEL" | "AMEND">("CANCEL")
  const [reason, setReason] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const cancellation = useInvestmentSubmission<Record<string, never>>({
    intentKey: [
      bookId ?? "none",
      operation.id,
      operation.version,
      position.version,
      reason,
    ].join(":"),
    execute: ({ bookId: activeBookId, requestId }) =>
      services.investments.operations.reverse.execute({
        bookId: activeBookId,
        requestId,
        operationId: operation.id,
        expectedOperationVersion: operation.version,
        expectedPositionVersion: position.version,
        reason: reason.trim(),
      }),
  })
  if (bookId === null)
    return (
      <Alert>
        <AlertTitle>Selecione um livro para corrigir investimentos</AlertTitle>
      </Alert>
    )
  if (!correctableOperation(operation, lastEffectiveOperationId))
    return (
      <Alert>
        <AlertTitle>Operação não corrigível</AlertTitle>
        <AlertDescription>
          Recarregue o histórico e selecione a última operação efetiva.
        </AlertDescription>
      </Alert>
    )

  const canAmend =
    operation.type !== "OPENING_ALLOCATION" &&
    operation.beforeKind === "EXISTING" &&
    operation.beforeBookCostMinor !== undefined &&
    operation.beforeStatus !== undefined
  const amendment = { operation, reason: reason.trim() }
  const targetPosition =
    canAmend && action === "AMEND"
      ? correctionPosition(position, operation)
      : position
  async function cancel() {
    if (!reason.trim()) {
      setFailure("Informe o motivo da correção.")
      return
    }
    setFailure(null)
    try {
      onSuccess?.(await cancellation.submit({}))
    } catch (error) {
      const message = correctionErrorMessage(error)
      setFailure(message)
      toast.add({
        type: "error",
        title: "Não foi possível corrigir a operação",
        description: message,
      })
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <FieldGroup>
        {canAmend && (
          <Field>
            <FieldLabel>Correção</FieldLabel>
            <ToggleGroup
              aria-label="Correção"
              multiple={false}
              value={[action]}
              onValueChange={(value) => {
                if (value[0] === "CANCEL" || value[0] === "AMEND")
                  setAction(value[0])
              }}
            >
              <ToggleGroupItem value="CANCEL">Cancelar</ToggleGroupItem>
              <ToggleGroupItem value="AMEND">Substituir</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        )}
        <Field data-invalid={failure === "Informe o motivo da correção."}>
          <FieldLabel htmlFor="investment-correction-reason">
            Motivo da correção
          </FieldLabel>
          <Input
            id="investment-correction-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={failure === "Informe o motivo da correção."}
            disabled={cancellation.isPending}
          />
        </Field>
      </FieldGroup>
      <Alert>
        <AlertTitle>Histórico preservado</AlertTitle>
        <AlertDescription>
          A correção mantém a operação original. A data da reversão é derivada
          da operação original; somente a data da substituição pode ser editada.
        </AlertDescription>
      </Alert>
      {failure && (
        <Alert variant="destructive">
          <AlertTitle>Correção não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      {action === "CANCEL" || !canAmend ? (
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={cancellation.isPending}
            onClick={onCancel}
          >
            Voltar
          </Button>
          <Button
            type="button"
            disabled={cancellation.isPending}
            onClick={cancel}
          >
            {cancellation.isPending && (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            )}
            Cancelar operação
          </Button>
        </div>
      ) : !reason.trim() ? (
        <Alert>
          <AlertTitle>Informe o motivo da correção</AlertTitle>
          <AlertDescription>
            O motivo é obrigatório antes de editar a substituição.
          </AlertDescription>
        </Alert>
      ) : operation.type === "PURCHASE" || operation.type === "APPLICATION" ? (
        <InvestmentPurchaseForm
          position={targetPosition}
          amendment={amendment}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      ) : operation.type === "SALE" || operation.type === "REDEMPTION" ? (
        <InvestmentSaleForm
          position={targetPosition}
          amendment={amendment}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      ) : operation.type === "INCOME" ? (
        <InvestmentIncomeForm
          position={targetPosition}
          amendment={amendment}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      ) : operation.type === "AMORTIZATION" ? (
        <InvestmentAmortizationForm
          position={targetPosition}
          amendment={amendment}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      ) : operation.type === "FEE" || operation.type === "TAX" ? (
        <InvestmentExpenseForm
          position={targetPosition}
          amendment={amendment}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  )
}
