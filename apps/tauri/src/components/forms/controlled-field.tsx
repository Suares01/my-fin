import type { ReactNode } from "react"
import type { FieldError as FormFieldError } from "react-hook-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"

export function ControlledField({
  id,
  label,
  description,
  error,
  disabled,
  children,
}: {
  readonly id: string
  readonly label: string
  readonly description?: ReactNode
  readonly error?: FormFieldError
  readonly disabled?: boolean
  readonly children: ReactNode
}) {
  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description && !error && (
        <FieldDescription id={`${id}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${id}-error`} errors={[error]} />
    </Field>
  )
}
