import { useId, useRef, useState } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import {
  ColorPicker,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerSelection,
} from "@workspace/ui/components/color-picker"
import { Input } from "@workspace/ui/components/input"
import { ControlledField } from "./controlled-field"
import type { ControlledFieldProps } from "./controlled-field-props"
import { cn } from "@workspace/ui/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Button } from "@workspace/ui/components/button"

function isHexColor(value: string): boolean {
  return /^[0-9a-f]{6}$/i.test(value)
}

function rgbToHex(rgb: readonly number[]): string {
  return rgb
    .slice(0, 3)
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")
}

function isRgbArray(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every((channel) => typeof channel === "number")
  )
}

export function ControlledColorPicker<
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
        const value = typeof field.value === "string" ? field.value : ""
        const visualValue = isHexColor(value) ? `#${value}` : undefined

        return (
          <ControlledField
            id={id}
            label={label}
            description={description}
            error={fieldState.error}
            disabled={disabled}
            labelInline
          >
            <div ref={popoverContainerRef} className="relative w-full">
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
                      className="w-1/2"
                      style={
                        visualValue
                          ? { backgroundColor: visualValue }
                          : undefined
                      }
                    />
                  }
                >
                  <div className="w-full text-center">{visualValue}</div>
                </PopoverTrigger>
                <PopoverContent
                  container={popoverContainerRef}
                  data-vaul-no-drag
                  className="p-4"
                >
                  <ColorPicker
                    value={visualValue}
                    onChange={(rgb) => {
                      if (!disabled && isHexColor(value) && isRgbArray(rgb)) {
                        field.onChange(rgbToHex(rgb))
                      }
                    }}
                    className="h-auto gap-3"
                  >
                    <ColorPickerSelection
                      aria-disabled={disabled}
                      className={cn("h-40 rounded-lg", {
                        "pointer-events-none opacity-50": disabled,
                      })}
                    />
                    <ColorPickerHue
                      aria-label="Matiz da cor"
                      disabled={disabled}
                    />

                    <div className="flex items-center gap-2">
                      <ColorPickerFormat />
                    </div>
                  </ColorPicker>
                </PopoverContent>
              </Popover>
            </div>

            <Input
              {...field}
              className="hidden"
              id={id}
              value={value}
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
              onChange={(event) => {
                if (!disabled) {
                  field.onChange(event.target.value)
                }
              }}
            />
          </ControlledField>
        )
      }}
    />
  )
}
