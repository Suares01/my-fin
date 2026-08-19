import { cn } from "@workspace/ui/lib/utils"
import { formatMinorAmount } from "./money.js"

export function FormattedMoney({
  amountMinor,
  currency = "BRL",
  locale = "pt-BR",
  className,
}: {
  readonly amountMinor: string
  readonly currency?: string
  readonly locale?: string
  readonly className?: string
}) {
  return (
    <span className={cn("font-medium tabular-nums", className)}>
      {formatMinorAmount(amountMinor, currency, locale)}
    </span>
  )
}
