import type { ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ErrorState } from "@workspace/ui/components/error-state"
import { Spinner } from "@workspace/ui/components/spinner"
import type { useTransactionFormOptions } from "../hooks/use-transaction-form-options"

export function TransactionFormAvailability({
  options,
  unsafeAmount,
  onCancel,
  children,
}: {
  readonly options: ReturnType<typeof useTransactionFormOptions>
  readonly unsafeAmount: boolean
  readonly onCancel: () => void
  readonly children: ReactNode
}) {
  if (options.loading)
    return (
      <div role="status" className="flex items-center gap-2">
        <Spinner aria-hidden="true" />
        Carregando opções da transação…
      </div>
    )

  if (options.error)
    return (
      <ErrorState
        variant="load-error"
        title="Não foi possível carregar as opções"
        actionLabel="Tentar novamente"
        onAction={() => void options.refresh()}
      />
    )

  if (options.bookId === null || !options.baseCurrency)
    return <ErrorState variant="book-required" />

  if (unsafeAmount)
    return (
      <ErrorState
        variant="amount-limit"
        description="Esta transação não pode ser editada neste formulário, pois seu valor excede 9007199254740991 centavos."
        actionLabel="Fechar"
        onAction={onCancel}
      />
    )

  if (options.requiresTwoAccounts)
    return (
      <ErrorState
        variant="transfer-accounts-required"
        actionLabel="Criar conta"
        actionHref="/accounts"
      />
    )

  if (options.missingAccounts)
    return (
      <ErrorState
        variant="accounts-required"
        actionLabel="Criar conta"
        actionHref="/accounts"
      />
    )

  if (options.missingCategories)
    return (
      <ErrorState
        variant="categories-required"
        actionLabel="Criar categoria"
        actionHref="/categories"
      />
    )
  return children
}

export function TransactionRefreshWarning() {
  return (
    <Alert>
      <AlertTitle>Transação salva</AlertTitle>
      <AlertDescription>
        Atualize os dados para ver todas as projeções.
      </AlertDescription>
    </Alert>
  )
}

export function TransactionFormActions({
  disabled,
  submitting,
  label,
  onCancel,
}: {
  readonly disabled: boolean
  readonly submitting: boolean
  readonly label: string
  readonly onCancel: () => void
}) {
  return (
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
        {submitting && <Spinner aria-hidden="true" data-icon="inline-start" />}
        {submitting ? `Salvando ${label}` : `Salvar ${label}`}
      </Button>
    </div>
  )
}
