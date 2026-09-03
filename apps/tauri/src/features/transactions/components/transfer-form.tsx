import type { JournalBusinessDraft } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import {
  transactionErrorMessage,
  transferDraftSchema,
} from "../transaction-form-model.js"
import { useTransactionFormOptions } from "../hooks/use-transaction-form-options.js"
import { TransactionFormFields } from "./transaction-form-fields.js"

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
function displayAmount(value?: string) {
  if (!value) return ""
  const amount = BigInt(value)
  return `${amount / 100n},${String(amount % 100n).padStart(2, "0")}`
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
  const [amount, setAmount] = useState(() =>
    displayAmount(initialDraft?.amountMinor)
  )
  const [amountMinor, setAmountMinor] = useState(
    initialDraft?.amountMinor ?? ""
  )
  const [occurredOn, setOccurredOn] = useState(initialDraft?.occurredOn ?? "")
  const [description, setDescription] = useState(
    initialDraft?.description ?? ""
  )
  const [sourceAccountId, setSourceAccountId] = useState(
    initialDraft?.sourceAccountId ?? ""
  )
  const [destinationAccountId, setDestinationAccountId] = useState(
    initialDraft?.destinationAccountId ?? ""
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<unknown>(null)
  const [conflictLocked, setConflictLocked] = useState(false)
  if (options.loading) return <p>Carregando opções da transação…</p>
  if (options.error) return <OptionsError onRetry={options.refresh} />
  if (options.requiresTwoAccounts)
    return (
      <Alert>
        <AlertTitle>Crie pelo menos duas contas para transferir</AlertTitle>
        <AlertDescription>
          <a href="/accounts">Criar conta</a>
        </AlertDescription>
      </Alert>
    )
  const disabled = pending || conflictLocked
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || options.bookId === null) return
    const parsed = transferDraftSchema.safeParse({
      type: "TRANSFER",
      sourceAccountId,
      destinationAccountId,
      amountMinor,
      currency: options.baseCurrency ?? "",
      occurredOn,
      description,
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message
      setErrors(next)
      return
    }
    try {
      setErrors({})
      setLocalError(null)
      await onSubmit(parsed.data)
    } catch (error) {
      setLocalError(error)
      if (isConflict(error)) setConflictLocked(true)
    }
  }
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={submit}
      aria-busy={disabled}
    >
      {submitError !== undefined || localError !== null ? (
        <FormError error={submitError ?? localError} />
      ) : null}
      {refreshWarning && (
        <Alert>
          <AlertTitle>Transação salva</AlertTitle>
          <AlertDescription>
            Atualize os dados para ver todas as projeções.
          </AlertDescription>
        </Alert>
      )}
      {conflictLocked && (
        <Alert variant="destructive">
          <AlertTitle>Este lançamento mudou</AlertTitle>
          <AlertDescription>
            Atualize os dados antes de tentar novamente.
          </AlertDescription>
        </Alert>
      )}
      <SelectField
        id="transfer-source"
        label="Conta de origem"
        value={sourceAccountId}
        options={options.accounts}
        error={errors.sourceAccountId}
        disabled={disabled}
        onChange={setSourceAccountId}
      />
      <SelectField
        id="transfer-destination"
        label="Conta de destino"
        value={destinationAccountId}
        options={options.accounts}
        error={errors.destinationAccountId}
        disabled={disabled}
        onChange={setDestinationAccountId}
      />
      <TransactionFormFields
        amount={amount}
        currency={options.baseCurrency ?? "BRL"}
        occurredOn={occurredOn}
        description={description}
        errors={errors}
        disabled={disabled}
        onAmountChange={(value) => {
          setAmount(value.display)
          setAmountMinor(value.amountMinor ?? "")
        }}
        onOccurredOnChange={setOccurredOn}
        onDescriptionChange={setDescription}
      />
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={disabled}>
          {pending && <Spinner aria-hidden="true" data-icon="inline-start" />}
          {pending ? "Salvando transferência" : "Salvar transferência"}
        </Button>
      </div>
    </form>
  )
}
function SelectField({
  id,
  label,
  value,
  options,
  error,
  disabled,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly { id: string; name: string }[]
  readonly error?: string
  readonly disabled: boolean
  readonly onChange: (value: string) => void
}) {
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <FieldError>{error}</FieldError>
    </Field>
  )
}
function OptionsError({ onRetry }: { readonly onRetry: () => Promise<void> }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar as opções</AlertTitle>
      <AlertDescription>
        <Button type="button" variant="link" onClick={() => void onRetry()}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  )
}
function FormError({ error }: { readonly error: unknown }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível salvar a transação</AlertTitle>
      <AlertDescription>{transactionErrorMessage(error)}</AlertDescription>
    </Alert>
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
