import type { JournalBusinessDraft } from "@workspace/application"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState } from "react"
import { incomeDraftSchema, transactionErrorMessage } from "../transaction-form-model.js"
import { useTransactionFormOptions } from "../hooks/use-transaction-form-options.js"
import { TransactionFormFields } from "./transaction-form-fields.js"

export type IncomeTransactionDraft = Omit<
  Extract<JournalBusinessDraft, { readonly type: "INCOME" | "EXPENSE" }>,
  "type"
> & { readonly type: "INCOME" }

type IncomeFormProps = {
  readonly initialDraft?: IncomeTransactionDraft
  readonly pending?: boolean
  readonly submitError?: unknown
  readonly refreshWarning?: boolean
  readonly onSubmit: (draft: IncomeTransactionDraft) => Promise<void>
  readonly onCancel: () => void
}

function displayAmount(amountMinor: string | undefined): string {
  if (!amountMinor) return ""
  const amount = BigInt(amountMinor)
  return `${amount / 100n},${String(amount % 100n).padStart(2, "0")}`
}

export function IncomeForm({
  initialDraft,
  pending = false,
  submitError,
  refreshWarning = false,
  onSubmit,
  onCancel,
}: IncomeFormProps) {
  const options = useTransactionFormOptions("INCOME")
  const [amount, setAmount] = useState(() => displayAmount(initialDraft?.amountMinor))
  const [amountMinor, setAmountMinor] = useState(initialDraft?.amountMinor ?? "")
  const [occurredOn, setOccurredOn] = useState(initialDraft?.occurredOn ?? "")
  const [description, setDescription] = useState(initialDraft?.description ?? "")
  const [accountId, setAccountId] = useState(initialDraft?.accountId ?? "")
  const [categoryId, setCategoryId] = useState(initialDraft?.categoryId ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<unknown>(null)
  const [conflictLocked, setConflictLocked] = useState(false)

  if (options.loading) return <p>Carregando opções da transação…</p>
  if (options.error) return <OptionsError onRetry={options.refresh} />
  if (options.missingAccounts) return <MissingResource resource="conta" href="/accounts" />
  if (options.missingCategories)
    return <MissingResource resource="categoria" href="/categories" />

  const disabled = pending || conflictLocked
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || options.bookId === null) return
    const parsed = incomeDraftSchema.safeParse({ type: "INCOME", accountId, categoryId, amountMinor, currency: options.baseCurrency ?? "", occurredOn, description })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message
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
    <form className="flex flex-col gap-6" onSubmit={submit} aria-busy={disabled}>
      {submitError !== undefined || localError !== null ? <FormError error={submitError ?? localError} /> : null}
      {refreshWarning && <Alert><AlertTitle>Transação salva</AlertTitle><AlertDescription>Atualize os dados para ver todas as projeções.</AlertDescription></Alert>}
      {conflictLocked && <Alert variant="destructive"><AlertTitle>Este lançamento mudou</AlertTitle><AlertDescription>Atualize os dados antes de tentar novamente.</AlertDescription></Alert>}
      <SelectField id="income-account" label="Conta" value={accountId} options={options.accounts} error={errors.accountId} disabled={disabled} onChange={setAccountId} />
      <SelectField id="income-category" label="Categoria" value={categoryId} options={options.categories} error={errors.categoryId} disabled={disabled} onChange={setCategoryId} />
      <TransactionFormFields amount={amount} currency={options.baseCurrency ?? "BRL"} occurredOn={occurredOn} description={description} errors={errors} disabled={disabled} onAmountChange={(value) => { setAmount(value.display); setAmountMinor(value.amountMinor ?? "") }} onOccurredOnChange={setOccurredOn} onDescriptionChange={setDescription} />
      <div className="flex gap-3 justify-end"><Button type="button" variant="ghost" disabled={disabled} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={disabled}>{pending && <Spinner aria-hidden="true" data-icon="inline-start" />}{pending ? "Salvando receita" : "Salvar receita"}</Button></div>
    </form>
  )
}

function SelectField({ id, label, value, options, error, disabled, onChange }: { readonly id: string; readonly label: string; readonly value: string; readonly options: readonly { id: string; name: string }[]; readonly error?: string; readonly disabled: boolean; readonly onChange: (value: string) => void }) {
  return <Field data-invalid={error ? "true" : undefined}><FieldLabel htmlFor={id}>{label}</FieldLabel><select id={id} value={value} disabled={disabled} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.currentTarget.value)}><option value="">Selecione</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><FieldError>{error}</FieldError></Field>
}
function MissingResource({ resource, href }: { readonly resource: string; readonly href: string }) { return <Alert><AlertTitle>Crie uma {resource} antes de continuar</AlertTitle><AlertDescription><a href={href}>Criar {resource}</a></AlertDescription></Alert> }
function OptionsError({ onRetry }: { readonly onRetry: () => Promise<void> }) { return <Alert variant="destructive"><AlertTitle>Não foi possível carregar as opções</AlertTitle><AlertDescription><Button type="button" variant="link" onClick={() => void onRetry()}>Tentar novamente</Button></AlertDescription></Alert> }
function FormError({ error }: { readonly error: unknown }) { return <Alert variant="destructive"><AlertTitle>Não foi possível salvar a transação</AlertTitle><AlertDescription>{transactionErrorMessage(error)}</AlertDescription></Alert> }
function isConflict(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "OPTIMISTIC_CONCURRENCY_FAILURE" }
