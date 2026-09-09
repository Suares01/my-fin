import { useId, useState } from "react"
import { Controller, type FieldValues } from "react-hook-form"
import { format, parse, isValid } from "date-fns"
import { ptBR } from "date-fns/locale/pt-BR"
import { CalendarDays } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ControlledField } from "./controlled-field"
import type { ControlledFieldProps } from "./controlled-field-props"

export function ControlledDatePicker<
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
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const date = parse(field.value || "", "yyyy-MM-dd", new Date())
        const selectedDate = isValid(date) ? date : undefined
        return (
          <ControlledField
            id={id}
            label={label}
            description={description}
            error={fieldState.error}
            disabled={disabled}
          >
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
                    className="w-full justify-start"
                  />
                }
              >
                <CalendarDays data-icon="inline-start" />
                {selectedDate
                  ? format(selectedDate, "PPP", { locale: ptBR })
                  : "Selecione a data"}
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
              >
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  locale={ptBR}
                  disabled={disabled}
                  onSelect={(nextDate) => {
                    field.onChange(
                      nextDate ? format(nextDate, "yyyy-MM-dd") : ""
                    )
                    field.onBlur()
                    if (nextDate) setOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </ControlledField>
        )
      }}
    />
  )
}
