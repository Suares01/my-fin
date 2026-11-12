import type { PreviewInvestmentPositionOpeningCommand } from "@workspace/application"
import { z } from "zod"

const MAX_MINOR = 9223372036854775807n

export const UNIT_REQUIRED_TYPES = new Set([
  "STOCK",
  "BDR",
  "ETF",
  "REAL_ESTATE_FUND",
  "MUTUAL_FUND",
  "CRYPTO_ASSET",
])

export const FIXED_INCOME_TYPES = new Set([
  "CDB",
  "RDB",
  "LCI",
  "LCA",
  "LC",
  "CRI",
  "CRA",
  "DEBENTURE",
  "LF",
  "LIG",
  "TREASURY",
])

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
export type OpeningRegistrationStep =
  | "CHOICE"
  | "POSITION"
  | "ACCOUNTING"
  | "REVIEW"

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

export function isUnitsRequired(type: string | undefined): boolean {
  return type !== undefined && UNIT_REQUIRED_TYPES.has(type)
}

export function isFixedIncome(type: string | undefined): boolean {
  return type !== undefined && FIXED_INCOME_TYPES.has(type)
}

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

export function selectedOpeningTerms(values: OpeningFormValues) {
  const terms = {
    ...(values.rateKind ? { rateKind: values.rateKind } : {}),
    ...(values.index ? { index: values.index } : {}),
    ...(values.annualRate
      ? { annualRate: values.annualRate.replace(",", ".") }
      : {}),
    ...(values.indexPercentage
      ? { indexPercentage: values.indexPercentage.replace(",", ".") }
      : {}),
    ...(values.annualSpreadRate
      ? { annualSpreadRate: values.annualSpreadRate.replace(",", ".") }
      : {}),
    ...(values.issueDate ? { issueDate: values.issueDate } : {}),
    ...(values.gracePeriodDate
      ? { gracePeriodDate: values.gracePeriodDate }
      : {}),
    ...(values.maturityDate ? { maturityDate: values.maturityDate } : {}),
  }
  return Object.keys(terms).length > 0 ? terms : undefined
}

export function openingTermsError(values: OpeningFormValues): string | null {
  if (
    values.rateKind === "PREFIXED" &&
    !/^\d+(?:[.,]\d+)?$/.test(values.annualRate)
  )
    return "Informe a taxa anual."
  if (
    (values.rateKind === "INDEXED" || values.rateKind === "HYBRID") &&
    (!values.index || !/^\d+(?:[.,]\d+)?$/.test(values.indexPercentage))
  )
    return "Informe índice e percentual."
  if (
    values.rateKind === "HYBRID" &&
    !/^\d+(?:[.,]\d+)?$/.test(values.annualSpreadRate)
  )
    return "Informe o spread anual."
  if (
    values.rateKind === "" &&
    (values.index ||
      values.annualRate ||
      values.indexPercentage ||
      values.annualSpreadRate)
  )
    return "Escolha o tipo de taxa."

  const dates = [
    values.issueDate,
    values.gracePeriodDate,
    values.maturityDate,
  ].filter(Boolean)
  if (
    dates.some(
      (date) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    )
  )
    return "Informe datas válidas."
  if (dates.some((date, index) => index > 0 && date < dates[index - 1]!))
    return "Informe os termos em ordem cronológica."
  return null
}

export function openingStepErrors(
  step: OpeningRegistrationStep,
  values: OpeningFormValues,
  context: {
    readonly fixedIncome: boolean
    readonly unitsRequired: boolean
    readonly externalAccountIds: readonly string[]
  }
): Partial<Record<keyof OpeningFormValues, string>> {
  const errors: Partial<Record<keyof OpeningFormValues, string>> = {}

  if (step === "CHOICE") {
    if (!values.instrumentId) errors.instrumentId = "Escolha o instrumento."
    if (!values.investmentAccountId)
      errors.investmentAccountId = "Escolha a carteira."
    return errors
  }

  if (step === "POSITION") {
    const amount = parseOpeningMoney(values.costDisplay)
    if (amount === null || (values.mode === "BUY" && amount === "0"))
      errors.costDisplay =
        values.mode === "OWNED"
          ? "Informe o custo contábil."
          : "Informe o valor principal."

    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.occurredOn))
      errors.occurredOn = "Informe a data da abertura."

    if (
      (context.unitsRequired || values.quantityMode === "UNITS") &&
      parseOpeningQuantity(values.quantity) === null
    )
      errors.quantity = "Informe a quantidade."

    if (context.fixedIncome) {
      const termsError = openingTermsError(values)
      if (termsError !== null) errors.rateKind = termsError
    }
    return errors
  }

  if (step === "ACCOUNTING") {
    if (values.mode === "BUY" && values.origin === "NOT_RECORDED")
      errors.origin = "Escolha a origem do dinheiro."
    if (
      values.origin === "EXTERNAL_ACCOUNT" &&
      !context.externalAccountIds.includes(values.externalAccountId)
    )
      errors.externalAccountId = "Escolha a conta de origem."
    if (
      values.origin === "NOT_RECORDED" &&
      parseOpeningMoney(values.initialCashDisplay) === null
    )
      errors.initialCashDisplay = "Informe o caixa inicial real."
  }

  return errors
}

export function openingPreviewCommand(input: {
  readonly values: OpeningFormValues
  readonly bookId: string | null
  readonly currency: string | undefined
  readonly walletId: string | undefined
  readonly instrumentId: string | undefined
  readonly fixedIncome: boolean
  readonly unitsRequired: boolean
  readonly confirmedBalance: boolean
  readonly externalAccountIds: readonly string[]
}): PreviewInvestmentPositionOpeningCommand | null {
  const {
    values,
    bookId,
    currency,
    walletId,
    instrumentId,
    fixedIncome,
    unitsRequired,
    confirmedBalance,
    externalAccountIds,
  } = input
  if (!bookId || !currency || !walletId || !instrumentId) return null
  if (unitsRequired && values.quantityMode !== "UNITS") return null

  const errors = {
    ...openingStepErrors("POSITION", values, {
      fixedIncome,
      unitsRequired,
      externalAccountIds,
    }),
    ...openingStepErrors("ACCOUNTING", values, {
      fixedIncome,
      unitsRequired,
      externalAccountIds,
    }),
  }
  if (Object.keys(errors).length > 0) return null

  const amount = parseOpeningMoney(values.costDisplay)
  if (amount === null) return null
  const quantity =
    values.quantityMode === "UNITS"
      ? parseOpeningQuantity(values.quantity)
      : undefined
  if (quantity === null) return null

  const common = {
    bookId,
    investmentAccountId: walletId,
    instrumentId,
    quantityMode: values.quantityMode,
    occurredOn: values.occurredOn,
    ...(optional(values.label) ? { label: optional(values.label) } : {}),
    ...(fixedIncome && selectedOpeningTerms(values)
      ? { fixedIncomeTerms: selectedOpeningTerms(values) }
      : {}),
  } as const

  if (values.mode === "OWNED" && values.origin !== "EXTERNAL_ACCOUNT") {
    const initialCash =
      values.origin === "NOT_RECORDED"
        ? parseOpeningMoney(values.initialCashDisplay)
        : undefined
    if (initialCash === null) return null
    return {
      ...common,
      kind: "ALLOCATION",
      bookCostMinor: amount,
      ...(quantity === undefined ? {} : { quantity }),
      ...(values.origin === "NOT_RECORDED" && !confirmedBalance
        ? {
            proposedOpeningBalanceMinor: (
              BigInt(amount) + BigInt(initialCash ?? "0")
            ).toString(),
          }
        : {}),
    }
  }

  return {
    ...common,
    kind: "PURCHASE",
    type: values.mode === "BUY" ? "PURCHASE" : "APPLICATION",
    currency,
    capitalMinor: amount,
    description: values.description.trim() || "Abertura de investimento",
    funding:
      values.origin === "EXTERNAL_ACCOUNT"
        ? { mode: "EXTERNAL_ACCOUNT", accountId: values.externalAccountId }
        : { mode: "INTERNAL_CASH" },
    ...(quantity === undefined ? {} : { quantityDelta: quantity }),
  }
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
