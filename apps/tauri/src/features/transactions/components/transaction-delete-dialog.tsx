import type { JournalChainDetail } from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Spinner } from "@workspace/ui/components/spinner"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import {
  cancellationSchema,
  localCivilDate,
} from "../transaction-form-model.js"
import { ControlledDatePicker } from "../../../components/forms/controlled-date-picker"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { useTransactionFormSubmission } from "../hooks/use-transaction-form-submission"

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
  const description = `Cancelamento de: ${detail.description}`
  const schema = cancellationSchema(detail.occurredOn)
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { occurredOn: localCivilDate(), description },
  })

  const submission = useTransactionFormSubmission({
    onSubmit: onConfirm,
    submitError,
    blocked: pending,
    errorTitle: "Não foi possível cancelar a transação",
    errorAction: "cancelar",
  })

  const submitting = pending || form.formState.isSubmitting
  const disabled = submitting || submission.conflictLocked

  return (
    <Drawer
      direction="right"
      modal={false}
      open
      onOpenChange={(open) => {
        if (!open && !disabled) onCancel()
      }}
    >
      <DrawerBackdrop data-slot="transaction-cancellation-drawer-backdrop" />
      <DrawerContent
        className="w-full data-[vaul-drawer-direction=right]:sm:max-w-xl"
        aria-label="Cancelar lançamento"
      >
        <DrawerHeader>
          <DrawerTitle>Cancelar lançamento</DrawerTitle>
          <DrawerDescription>
            O efeito financeiro será cancelado, mas o histórico da transação
            será preservado.
          </DrawerDescription>
        </DrawerHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4"
          onSubmit={form.handleSubmit(submission.submit)}
          aria-busy={submitting}
        >
          <FieldGroup>
            <ControlledDatePicker
              control={form.control}
              name="occurredOn"
              label="Data de cancelamento"
              description="Você pode ajustar a data do cancelamento."
              disabled={disabled}
            />
            <ControlledInput
              control={form.control}
              name="description"
              label="Descrição do cancelamento"
              readOnly
              description="A descrição é gerada para manter o vínculo com a transação original."
              disabled={disabled}
            />
          </FieldGroup>
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
      </DrawerContent>
    </Drawer>
  )
}
