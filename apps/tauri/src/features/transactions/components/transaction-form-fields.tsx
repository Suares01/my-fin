import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { MoneyInput, type MoneyInputValue } from "@workspace/ui/money"

export type TransactionFormFieldErrors = Partial<
  Record<"amountMinor" | "occurredOn" | "description", string>
>

export type TransactionFormFieldsProps = {
  readonly amount: string
  readonly currency: string
  readonly occurredOn: string
  readonly description: string
  readonly errors?: TransactionFormFieldErrors
  readonly disabled?: boolean
  readonly onAmountChange: (value: MoneyInputValue) => void
  readonly onOccurredOnChange: (value: string) => void
  readonly onDescriptionChange: (value: string) => void
}

export function TransactionFormFields({
  amount,
  currency,
  occurredOn,
  description,
  errors = {},
  disabled = false,
  onAmountChange,
  onOccurredOnChange,
  onDescriptionChange,
}: TransactionFormFieldsProps) {
  return (
    <div className="flex flex-col gap-6">
      <MoneyInput
        id="transaction-amount"
        label="Valor"
        value={amount}
        currency={currency}
        error={errors.amountMinor}
        disabled={disabled}
        onValueChange={onAmountChange}
      />
      <Field data-invalid={errors.occurredOn ? "true" : undefined}>
        <FieldLabel htmlFor="transaction-occurred-on">Data</FieldLabel>
        <Input
          id="transaction-occurred-on"
          type="date"
          value={occurredOn}
          disabled={disabled}
          aria-invalid={Boolean(errors.occurredOn)}
          aria-describedby="transaction-occurred-on-description transaction-occurred-on-error"
          onChange={(event) => onOccurredOnChange(event.currentTarget.value)}
        />
        <FieldDescription id="transaction-occurred-on-description">
          Use a data em que a transação aconteceu.
        </FieldDescription>
        <FieldError id="transaction-occurred-on-error">
          {errors.occurredOn}
        </FieldError>
      </Field>
      <Field data-invalid={errors.description ? "true" : undefined}>
        <FieldLabel htmlFor="transaction-description">Descrição</FieldLabel>
        <Input
          id="transaction-description"
          value={description}
          disabled={disabled}
          aria-invalid={Boolean(errors.description)}
          aria-describedby="transaction-description-description transaction-description-error"
          onChange={(event) => onDescriptionChange(event.currentTarget.value)}
        />
        <FieldDescription id="transaction-description-description">
          Identifique a transação para encontrá-la no histórico.
        </FieldDescription>
        <FieldError id="transaction-description-error">
          {errors.description}
        </FieldError>
      </Field>
    </div>
  )
}
