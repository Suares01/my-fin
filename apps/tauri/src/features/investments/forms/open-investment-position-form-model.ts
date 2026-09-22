import { z } from "zod"

const MAX_MINOR = 9223372036854775807n

export const openingFormSchema = z.object({
  mode: z.enum(["OWNED", "BUY"]),
  origin: z.enum(["INTERNAL_CASH", "EXTERNAL_ACCOUNT", "NOT_RECORDED"]),
  investmentAccountId: z.string(),
  instrumentId: z.string(),
  externalAccountId: z.string(),
  quantityMode: z.enum(["AMOUNT", "UNITS"]),
  quantity: z.string(),
  costDisplay: z.string(),
  initialCashDisplay: z.string(),
  valuationDisplay: z.string(),
  occurredOn: z.string(),
  label: z.string(),
  description: z.string(),
  rateKind: z.enum(["", "PREFIXED", "INDEXED", "HYBRID"]),
  index: z.string(),
  annualRate: z.string(),
  indexPercentage: z.string(),
  annualSpreadRate: z.string(),
  issueDate: z.string(),
  gracePeriodDate: z.string(),
  maturityDate: z.string(),
})

export type OpeningFormValues = z.infer<typeof openingFormSchema>

export const openingFormDefaults: OpeningFormValues = {
  mode: "OWNED",
  origin: "INTERNAL_CASH",
  investmentAccountId: "",
  instrumentId: "",
  externalAccountId: "",
  quantityMode: "AMOUNT",
  quantity: "",
  costDisplay: "",
  initialCashDisplay: "0",
  valuationDisplay: "",
  occurredOn: "",
  label: "",
  description: "Abertura de investimento",
  rateKind: "",
  index: "",
  annualRate: "",
  indexPercentage: "",
  annualSpreadRate: "",
  issueDate: "",
  gracePeriodDate: "",
  maturityDate: "",
}

export function parseOpeningMoney(display: string): string | null {
  const normalized = display.trim()
  if (!/^\d+(?:,\d{0,2})?$/.test(normalized)) return null
  const [whole = "0", fraction = ""] = normalized.split(",")
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0")
  return minor > MAX_MINOR ? null : minor.toString()
}

export function parseOpeningQuantity(display: string): string | null {
  const normalized = display.trim().replace(",", ".")
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized)) return null
  const [whole = "", fraction = ""] = normalized.split(".")
  if (`${whole}${fraction}`.replace(/^0+/, "").length > 38) return null
  if (BigInt(whole) === 0n && !/[1-9]/.test(fraction)) return null
  return `${BigInt(whole)}${fraction ? `.${fraction.replace(/0+$/, "")}` : ""}`.replace(
    /\.$/,
    ""
  )
}

export function openingErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPENING_BALANCE_ALREADY_SET":
      return "Esta carteira já tem saldo inicial. Corrija o saldo inicial existente em Contas antes de continuar."
    case "INVESTMENT_BOOK_COST_REQUIRED":
      return "Informe o custo contábil; valor atual não substitui custo."
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "A posição mudou. Atualize os dados e revise a abertura."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar o investimento. Os dados foram preservados; tente novamente."
  }
}
