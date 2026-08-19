"use client"

import * as React from "react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { parseMoneyInput, type MoneyInputValue } from "./money.js"

export interface MoneyInputProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "value"
> {
  readonly label: string
  readonly value?: string
  readonly onValueChange?: (value: MoneyInputValue) => void
  readonly error?: string
  readonly description?: string
  readonly currency?: string
}

export function MoneyInput({
  id,
  label,
  value = "",
  onValueChange,
  error,
  description = "Informe o valor em reais, com até duas casas decimais.",
  currency = "BRL",
  disabled,
  ...props
}: MoneyInputProps) {
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <FieldGroup>
      <Field
        data-invalid={error ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
      >
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <InputGroup
          className="touch-target"
          data-disabled={disabled ? "true" : undefined}
        >
          <InputGroupAddon aria-hidden="true">
            <InputGroupText>{currency}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            {...props}
            {...(describedBy ? { "aria-describedby": describedBy } : {})}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            id={id}
            inputMode="decimal"
            onChange={(event) => {
              const next = event.currentTarget.value
              const parsed = parseMoneyInput(next)
              onValueChange?.(
                parsed.ok ? parsed.value : { display: next, amountMinor: null }
              )
            }}
            value={value}
          />
        </InputGroup>
        {description && (
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
        )}
        <FieldError id={errorId}>{error}</FieldError>
      </Field>
    </FieldGroup>
  )
}
