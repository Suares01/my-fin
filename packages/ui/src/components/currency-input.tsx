import type { ChangeEvent, ComponentProps } from "react"
import { Input } from "./input"
import { formatMinorAmount } from "../money/money"

type CurrencyInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange"
> & {
  value: number
  currency?: string
  onValueChange: (valueInCents: number) => void
}

export function CurrencyInput({
  value,
  onValueChange,
  currency = "BRL",
  ...props
}: CurrencyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "")

    // Check the original digits before converting them to a floating-point number.
    if (digits && BigInt(digits) > BigInt(Number.MAX_SAFE_INTEGER)) return
    const valueInCents = digits ? Number(digits) : 0

    onValueChange(valueInCents)
  }

  const formattedValue = formatMinorAmount(String(value), currency)

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={formattedValue}
      onChange={handleChange}
    />
  )
}
