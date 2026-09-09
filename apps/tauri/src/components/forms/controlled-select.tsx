import { useId } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ControlledField } from "./controlled-field"
import type { ControlledFieldProps } from "./controlled-field-props"

export function ControlledSelect<
  TValues extends FieldValues,
  TOutput = TValues,
>({
  control,
  name,
  label,
  description,
  disabled,
  options,
  placeholder = "Selecione",
}: ControlledFieldProps<TValues, string, TOutput> & {
  readonly options: readonly {
    readonly value: string
    readonly label: string
  }[]
  readonly placeholder?: string
}) {
  const id = useId()
  const items = [{ value: null, label: placeholder }, ...options]
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
          <Select
            name={field.name}
            items={items}
            value={field.value || null}
            onValueChange={(value) => field.onChange(value ?? "")}
            disabled={disabled}
            modal={false}
          >
            <SelectTrigger
              ref={field.ref}
              onBlur={field.onBlur}
              id={id}
              className="w-full"
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
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {items.map((item) => (
                  <SelectItem key={item.value ?? "empty"} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ControlledField>
      )}
    />
  )
}
