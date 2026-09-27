import type {
  InvestmentMutationResult,
  InvestmentPositionView,
  RecordInvestmentValuationCommand,
} from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { useActiveBook, useMyFin } from "../../../providers"
import { useInvestmentSubmission } from "../hooks/use-investment-submission"
import {
  buildValuationDraft,
  valuationErrorMessage,
  valuationFormDefaults,
  valuationFormSchema,
  type ValuationFormValues,
} from "./investment-valuation-form-model"

type Props = {
  readonly position: InvestmentPositionView
  readonly onSuccess?: (result: InvestmentMutationResult) => void
  readonly onCancel?: () => void
}

export function InvestmentValuationForm({
  position,
  onSuccess,
  onCancel,
}: Props) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<ValuationFormValues>({
    resolver: zodResolver(valuationFormSchema),
    defaultValues: {
      ...valuationFormDefaults,
      ...(position.quantity === undefined
        ? {}
        : { quantity: position.quantity }),
    },
  })
  const values = useWatch({ control: form.control }) as ValuationFormValues
  const intentKey = [
    bookId ?? "none",
    position.id,
    position.allocationRevision,
    JSON.stringify(values),
  ].join(":")
  const valuation = useInvestmentSubmission<RecordInvestmentValuationCommand>({
    intentKey,
    execute: ({ bookId: activeBookId, requestId, draft }) =>
      services.investments.valuations.record.execute({
        ...draft,
        bookId: activeBookId,
        requestId,
      }),
  })
  const pending = form.formState.isSubmitting || valuation.isPending
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    if (bookId === null) return
    const validated = buildValuationDraft({
      values,
      position,
      bookId,
      requestId: valuation.requestId,
    })
    if (!validated.ok) {
      form.setError(validated.field, { message: validated.message })
      return
    }
    try {
      onSuccess?.(await valuation.submit(validated.draft))
    } catch (error) {
      const message = valuationErrorMessage(error)
      setFailure(message)
      toast.add({
        type: "error",
        title: "Não foi possível salvar a avaliação",
        description: message,
      })
    }
  })
  if (bookId === null)
    return (
      <Alert>
        <AlertTitle>Selecione um livro para operar investimentos</AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <ControlledInput
          control={form.control}
          name="grossDisplay"
          label="Valor bruto"
          disabled={pending}
        />
        <ControlledInput
          control={form.control}
          name="netDisplay"
          label="Valor líquido"
          disabled={pending}
        />
        <ControlledInput
          control={form.control}
          name="withdrawableDisplay"
          label="Valor resgatável"
          disabled={pending}
        />
        {position.quantity !== undefined && (
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <ControlledInput
              control={form.control}
              name="quantity"
              label="Quantidade"
              disabled={pending}
            />
            <ControlledInput
              control={form.control}
              name="unitPrice"
              label="Preço unitário"
              disabled={pending}
            />
          </FieldGroup>
        )}
        <ControlledInput
          control={form.control}
          name="valuedAt"
          label="Instante da avaliação"
          type="datetime-local"
          disabled={pending}
        />
      </FieldGroup>
      <Alert>
        <AlertTitle>Observação de valor</AlertTitle>
        <AlertDescription>
          A avaliação não altera custo, lucro realizado ou lançamentos
          contábeis.
        </AlertDescription>
      </Alert>
      {Object.values(form.formState.errors).length > 0 && (
        <Alert>
          <AlertTitle>Revise os campos</AlertTitle>
          <AlertDescription>
            {Object.values(form.formState.errors).map((issue, index) => (
              <p key={index}>{String(issue?.message ?? "")}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {failure && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          Registrar avaliação
        </Button>
      </div>
    </form>
  )
}
