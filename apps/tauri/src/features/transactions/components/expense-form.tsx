import type { JournalBusinessDraft } from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import type { z } from "zod"
import { FieldGroup } from "@workspace/ui/components/field"
import {
  expenseFormSchema,
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
import { TransactionAccountCategoryFields } from "./transaction-account-category-fields"

export type ExpenseTransactionDraft = Omit<
  Extract<JournalBusinessDraft, { readonly type: "INCOME" | "EXPENSE" }>,
  "type"
> & { readonly type: "EXPENSE" }

type ExpenseFormProps = {
  readonly initialDraft?: ExpenseTransactionDraft
  readonly pending?: boolean
  readonly submitError?: unknown
  readonly refreshWarning?: boolean
  readonly onSubmit: (draft: ExpenseTransactionDraft) => Promise<void>
  readonly onCancel: () => void
}

export function ExpenseForm({
  initialDraft,
  pending = false,
  submitError,
  refreshWarning = false,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const options = useTransactionFormOptions("EXPENSE")
  const unsafeAmount = initialValueCents(initialDraft?.amountMinor) === null
  const form = useForm<
    z.input<typeof expenseFormSchema>,
    unknown,
    z.output<typeof expenseFormSchema>
  >({
    resolver: zodResolver(expenseFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      type: "EXPENSE",
      accountId: initialDraft?.accountId ?? "",
      categoryId: initialDraft?.categoryId ?? "",
      ...transactionCommonDefaults(initialDraft, options.baseCurrency),
    },
  })
  const { setValue } = form
  useEffect(() => {
    if (options.baseCurrency) setValue("currency", options.baseCurrency)
  }, [options.baseCurrency, setValue])

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
          <TransactionFormFields
            control={form.control}
            currency={options.baseCurrency ?? "BRL"}
            disabled={disabled}
          />
          <TransactionAccountCategoryFields
            control={form.control}
            accounts={options.accounts}
            categories={options.categories}
            disabled={disabled}
          />
        </FieldGroup>
        <TransactionFormActions
          disabled={disabled}
          submitting={submitting}
          label="despesa"
          onCancel={onCancel}
        />
      </form>
    </TransactionFormAvailability>
  )
}
