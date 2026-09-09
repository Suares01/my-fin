import { useId } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import { ControlledField } from "../../../components/forms/controlled-field"
import type { ControlledFieldProps } from "../../../components/forms/controlled-field-props"
import { getCategoryIconEntries } from "../../../components/category-icons"

const iconEntries = getCategoryIconEntries()

export function CategoryIconField<
  TValues extends FieldValues,
  TOutput = TValues,
>({
  control,
  name,
  label,
  description,
  disabled,
}: ControlledFieldProps<TValues, string, TOutput>) {
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
          <div
            id={id}
            role="radiogroup"
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
            className="grid grid-cols-4 gap-2 sm:grid-cols-6"
          >
            {iconEntries.map(({ name: iconName, Icon }, index) => {
              const optionId = `${id}-${iconName}`

              return (
                <label
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-transparent p-2 text-xs hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  data-disabled={disabled ? "true" : undefined}
                  htmlFor={optionId}
                  key={iconName}
                >
                  <input
                    id={optionId}
                    ref={index === 0 ? field.ref : undefined}
                    className="sr-only"
                    type="radio"
                    name={field.name}
                    value={iconName}
                    checked={field.value === iconName}
                    disabled={disabled}
                    aria-label={`Ícone ${iconName}`}
                    onBlur={field.onBlur}
                    onChange={() => field.onChange(iconName)}
                    onKeyDown={(event) => {
                      const direction =
                        event.key === "ArrowRight" || event.key === "ArrowDown"
                          ? 1
                          : event.key === "ArrowLeft" || event.key === "ArrowUp"
                            ? -1
                            : 0
                      if (!direction) return

                      const nextIndex =
                        (index + direction + iconEntries.length) %
                        iconEntries.length
                      event.preventDefault()
                      field.onChange(iconEntries[nextIndex]?.name)
                      document
                        .getElementById(`${id}-${iconEntries[nextIndex]?.name}`)
                        ?.focus()
                    }}
                  />
                  <Icon aria-hidden="true" className="size-5" />
                  <span className="sr-only">{iconName}</span>
                </label>
              )
            })}
          </div>
        </ControlledField>
      )}
    />
  )
}
