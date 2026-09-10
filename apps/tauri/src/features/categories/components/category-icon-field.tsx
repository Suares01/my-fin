import { useId, useRef, useState } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import { ControlledField } from "../../../components/forms/controlled-field"
import type { ControlledFieldProps } from "../../../components/forms/controlled-field-props"
import {
  getCategoryIconEntries,
  getCategoryIconOrFallback,
} from "../../../components/category-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Button } from "@workspace/ui/components/button"

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
  const popoverContainerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const SelectedIcon = getCategoryIconOrFallback(field.value)

        return (
          <ControlledField
            id={id}
            label={label}
            description={description}
            error={fieldState.error}
            disabled={disabled}
            labelInline
          >
            <div ref={popoverContainerRef} className="relative">
              <Popover open={open && !disabled} onOpenChange={setOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      ref={field.ref}
                      name={field.name}
                      onBlur={field.onBlur}
                      id={id}
                      type="button"
                      variant="outline"
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
                  }
                >
                  <SelectedIcon />
                </PopoverTrigger>
                <PopoverContent
                  container={popoverContainerRef}
                  data-vaul-no-drag
                  className="p-4"
                >
                  <div
                    id={`${id}-options`}
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
                      const selected = field.value === iconName

                      return (
                        <button
                          id={`${id}-option-${iconName}`}
                          type="button"
                          role="radio"
                          aria-label={`Ícone ${iconName}`}
                          aria-checked={selected}
                          tabIndex={selected || index === 0 ? 0 : -1}
                          data-checked={selected ? "true" : undefined}
                          className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-transparent p-2 text-xs hover:bg-muted focus-visible:border-ring focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[checked=true]:border-primary data-[checked=true]:bg-primary/10"
                          data-disabled={disabled ? "true" : undefined}
                          disabled={disabled}
                          key={iconName}
                          onClick={() => {
                            field.onChange(iconName)
                            field.onBlur()
                            setOpen(false)
                          }}
                          onKeyDown={(event) => {
                            const direction =
                              event.key === "ArrowRight" ||
                              event.key === "ArrowDown"
                                ? 1
                                : event.key === "ArrowLeft" ||
                                    event.key === "ArrowUp"
                                  ? -1
                                  : 0
                            if (!direction) return

                            const nextIndex =
                              (index + direction + iconEntries.length) %
                              iconEntries.length
                            event.preventDefault()
                            field.onChange(iconEntries[nextIndex]?.name)
                            document
                              .getElementById(
                                `${id}-option-${iconEntries[nextIndex]?.name}`
                              )
                              ?.focus()
                          }}
                        >
                          <Icon aria-hidden="true" className="size-5" />
                          <span className="sr-only">{iconName}</span>
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </ControlledField>
        )
      }}
    />
  )
}
