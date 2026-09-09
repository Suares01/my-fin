import { useId, type ComponentProps } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import { Input } from "@workspace/ui/components/input"
import { ControlledField } from "./controlled-field"
import type { ControlledFieldProps } from "./controlled-field-props"

type ControlledInputProps<
  TValues extends FieldValues,
  TOutput,
> = ControlledFieldProps<TValues, string, TOutput> &
  Pick<
    ComponentProps<typeof Input>,
    "placeholder" | "autoComplete" | "type" | "maxLength" | "readOnly"
  >

export function ControlledInput<
  TValues extends FieldValues,
  TOutput = TValues,
>({
  control,
  name,
  label,
  description,
  disabled,
  ...inputProps
}: ControlledInputProps<TValues, TOutput>) {
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
          <Input
            {...inputProps}
            {...field}
            value={field.value ?? ""}
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
