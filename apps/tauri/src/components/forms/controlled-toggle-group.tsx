import { useId } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { ControlledField } from "./controlled-field"
import type { ControlledFieldProps } from "./controlled-field-props"

export function ControlledToggleGroup<
  TValues extends FieldValues,
  TOutput = TValues,
>({
  control,
  name,
  label,
  description,
  disabled,
  options,
}: ControlledFieldProps<TValues, string, TOutput> & {
  readonly options: readonly {
    readonly value: string
    readonly label: string
  }[]
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
          <ToggleGroup
            id={id}
            aria-label={label}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              [
                description && `${id}-description`,
                fieldState.error && `${id}-error`,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            multiple={false}
            value={field.value ? [field.value] : []}
            onValueChange={(value) => field.onChange(value[0] ?? "")}
            onBlur={field.onBlur}
            className="w-full sm:w-fit"
            disabled={disabled}
          >
            {options.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="touch-target flex-1 sm:flex-none"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ControlledField>
      )}
    />
  )
}
