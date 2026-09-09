import type { Control, FieldPathByValue } from "react-hook-form"
import { FieldGroup } from "@workspace/ui/components/field"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledCurrencyInput } from "../../../components/forms/controlled-currency-input"
import { ControlledDatePicker } from "../../../components/forms/controlled-date-picker"
import type { TransactionCommonValues } from "../transaction-form-schema"

export function TransactionFormFields<
  TValues extends TransactionCommonValues,
  TOutput,
>({
  control,
  currency,
  disabled,
}: {
  readonly control: Control<TValues, unknown, TOutput>
  readonly currency: string
  readonly disabled: boolean
}) {
  // RHF cannot infer paths on an extended generic, although these keys are required above.
  return (
    <FieldGroup>
      <ControlledCurrencyInput
        control={control}
        name={"valueCents" as FieldPathByValue<TValues, number>}
        label="Valor"
        currency={currency}
        disabled={disabled}
      />
      <ControlledInput
        control={control}
        name={"description" as FieldPathByValue<TValues, string>}
        label="Descrição"
        description="Identifique a transação para encontrá-la no histórico."
        disabled={disabled}
      />
      <ControlledDatePicker
        control={control}
        name={"occurredOn" as FieldPathByValue<TValues, string>}
        label="Data"
        description="Use a data em que a transação aconteceu."
        disabled={disabled}
      />
    </FieldGroup>
  )
}
