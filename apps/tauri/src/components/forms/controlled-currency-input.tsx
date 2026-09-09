import { useId } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import { CurrencyInput } from "@workspace/ui/components/currency-input"
import { ControlledField } from "./controlled-field"
import type { ControlledFieldProps } from "./controlled-field-props"

export function ControlledCurrencyInput<
  TValues extends FieldValues,
  TOutput = TValues,
>({
  control,
  name,
  label,
  description,
  disabled,
  currency,
}: ControlledFieldProps<TValues, number, TOutput> & {
  readonly currency?: string
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ControlledField
          id={id}
          label={label}
          description={description}
          error={fieldState.error}
          disabled={disabled}
        >
          <CurrencyInput
            ref={field.ref}
            name={field.name}
            onBlur={field.onBlur}
            value={field.value}
            onValueChange={field.onChange}
            currency={currency}
            id={id}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              [
                description && `${id}-description`,
                fieldState.error && `${id}-error`,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
        </ControlledField>
      )}
    />
  )
}
