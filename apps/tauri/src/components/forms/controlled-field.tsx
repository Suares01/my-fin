import type { ReactNode } from "react"
import type { FieldError as FormFieldError } from "react-hook-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"

export function ControlledField({
  id,
  label,
  description,
  error,
  disabled,
  children,
  labelInline = false,
}: {
  readonly id: string
  readonly label: string
  readonly description?: ReactNode
  readonly error?: FormFieldError
  readonly disabled?: boolean
  readonly children: ReactNode
  readonly labelInline?: boolean
}) {
  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled}>
      <div
        className={cn("flex", {
          "flex-row gap-2": labelInline,
          "flex-col gap-1": !labelInline,
        })}
      >
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {children}
      </div>
      {description && !error && (
        <FieldDescription id={`${id}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${id}-error`} errors={[error]} />
    </Field>
  )
}
