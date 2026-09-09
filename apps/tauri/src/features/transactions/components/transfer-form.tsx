import type { JournalBusinessDraft } from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useEffect } from "react"
import type { z } from "zod"
import { FieldGroup } from "@workspace/ui/components/field"
import {
  transferFormSchema,
  initialValueCents,
  transactionCommonDefaults,
} from "../transaction-form-schema"
import { useTransactionFormOptions } from "../hooks/use-transaction-form-options"
import { useTransactionFormSubmission } from "../hooks/use-transaction-form-submission"
import { TransactionFormFields } from "./transaction-form-fields"
import {
  TransactionFormAvailability,
  TransactionFormActions,
  TransactionRefreshWarning,
} from "./transaction-form-feedback"
import { ControlledSelect } from "../../../components/forms/controlled-select"

export type TransferTransactionDraft = Extract<
  JournalBusinessDraft,
  { readonly type: "TRANSFER" }
>

type TransferFormProps = {
  readonly initialDraft?: TransferTransactionDraft
  readonly pending?: boolean
  readonly submitError?: unknown
  readonly refreshWarning?: boolean
  readonly onSubmit: (draft: TransferTransactionDraft) => Promise<void>
  readonly onCancel: () => void
}

export function TransferForm({
  initialDraft,
  pending = false,
  submitError,
  refreshWarning = false,
  onSubmit,
  onCancel,
}: TransferFormProps) {
  const options = useTransactionFormOptions("TRANSFER")
  const unsafeAmount = initialValueCents(initialDraft?.amountMinor) === null
  const form = useForm<
    z.input<typeof transferFormSchema>,
    unknown,
    z.output<typeof transferFormSchema>
  >({
    resolver: zodResolver(transferFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      type: "TRANSFER",
      sourceAccountId: initialDraft?.sourceAccountId ?? "",
      destinationAccountId: initialDraft?.destinationAccountId ?? "",
      ...transactionCommonDefaults(initialDraft, options.baseCurrency),
    },
  })
  const { setValue } = form
  useEffect(() => {
    if (options.baseCurrency) setValue("currency", options.baseCurrency)
  }, [options.baseCurrency, setValue])

  const sourceAccountId = useWatch({
    control: form.control,
    name: "sourceAccountId",
  })
  const { trigger } = form
  const { submitCount } = form.formState
  useEffect(() => {
    if (submitCount > 0) void trigger("destinationAccountId")
  }, [sourceAccountId, submitCount, trigger])

  const submission = useTransactionFormSubmission({
    onSubmit,
    submitError,
    blocked:
      pending ||
      unsafeAmount ||
      options.bookId === null ||
      !options.baseCurrency ||
      options.loading ||
      Boolean(options.error),
  })
  const submitting = pending || form.formState.isSubmitting
  const disabled = submitting || submission.conflictLocked

  return (
    <TransactionFormAvailability
      options={options}
      unsafeAmount={unsafeAmount}
      onCancel={onCancel}
    >
      <form
        noValidate
        className="flex w-full flex-col gap-6"
        onSubmit={form.handleSubmit(submission.submit)}
        aria-busy={submitting}
      >
        {refreshWarning && <TransactionRefreshWarning />}
        <FieldGroup>
          <ControlledSelect
            control={form.control}
            name="sourceAccountId"
            label="Conta de origem"
            options={options.accounts.map(({ id, name }) => ({
              value: id,
              label: name,
            }))}
            disabled={disabled}
          />
          <ControlledSelect
            control={form.control}
            name="destinationAccountId"
            label="Conta de destino"
            options={options.accounts.map(({ id, name }) => ({
              value: id,
              label: name,
            }))}
            disabled={disabled}
          />
          <TransactionFormFields
            control={form.control}
            currency={options.baseCurrency ?? "BRL"}
            disabled={disabled}
          />
        </FieldGroup>
        <TransactionFormActions
          disabled={disabled}
          submitting={submitting}
          label="transferência"
          onCancel={onCancel}
        />
      </form>
    </TransactionFormAvailability>
  )
}
