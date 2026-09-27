import type {
  InvestmentPositionView,
  RecordInvestmentValuationCommand,
} from "@workspace/application"
import { z } from "zod"
import { parseOpeningMoney } from "./open-investment-position-form-model"

export const valuationFormSchema = z.object({
  grossDisplay: z.string(),
  netDisplay: z.string(),
  withdrawableDisplay: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  valuedAt: z.string(),
})

export type ValuationFormValues = z.infer<typeof valuationFormSchema>

export const valuationFormDefaults: ValuationFormValues = {
  grossDisplay: "",
  netDisplay: "",
  withdrawableDisplay: "",
  quantity: "",
  unitPrice: "",
  valuedAt: "",
}

type ValidationResult =
  | { readonly ok: true; readonly draft: RecordInvestmentValuationCommand }
  | {
      readonly ok: false
      readonly field: keyof ValuationFormValues
      readonly message: string
    }

function optionalMoney(value: string): string | null | undefined {
  if (value.trim() === "") return undefined
  return valuationMoney(value)
}

function valuationMoney(value: string): string | null {
  const display = value.trim()
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(display)) return null
  return parseOpeningMoney(display.replaceAll(".", ""))
}

function canonicalDecimal(value: string): string | null {
  const normalized = value.trim().replace(",", ".")
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const [whole, fraction = ""] = normalized.split(".")
  return fraction.length === 0
    ? BigInt(whole).toString()
    : `${BigInt(whole).toString()}.${fraction.replace(/0+$/, "") || "0"}`
}

function instant(value: string): string | null {
  if (value.trim() === "") return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function buildValuationDraft(input: {
  readonly values: ValuationFormValues
  readonly position: InvestmentPositionView
  readonly bookId: string
  readonly requestId: string
}): ValidationResult {
  const { values, position, bookId, requestId } = input
  const grossValueMinor = valuationMoney(values.grossDisplay)
  if (grossValueMinor === null)
    return {
      ok: false,
      field: "grossDisplay",
      message: "Informe um valor bruto válido.",
    }
  const netValueMinor = optionalMoney(values.netDisplay)
  if (netValueMinor === null)
    return {
      ok: false,
      field: "netDisplay",
      message: "Informe um valor líquido válido.",
    }
  const withdrawableValueMinor = optionalMoney(values.withdrawableDisplay)
  if (withdrawableValueMinor === null)
    return {
      ok: false,
      field: "withdrawableDisplay",
      message: "Informe um valor resgatável válido.",
    }
  const valuedAt = instant(values.valuedAt)
  if (valuedAt === null)
    return {
      ok: false,
      field: "valuedAt",
      message: "Informe o instante da avaliação.",
    }
  const quantity =
    values.quantity.trim() === ""
      ? undefined
      : canonicalDecimal(values.quantity)
  if (quantity === null)
    return {
      ok: false,
      field: "quantity",
      message: "Informe uma quantidade válida.",
    }
  const unitPrice =
    values.unitPrice.trim() === ""
      ? undefined
      : canonicalDecimal(values.unitPrice)
  if (unitPrice === null)
    return {
      ok: false,
      field: "unitPrice",
      message: "Informe um preço unitário válido.",
    }
  if (
    position.quantity === undefined &&
    (quantity !== undefined || unitPrice !== undefined)
  )
    return {
      ok: false,
      field: "unitPrice",
      message: "Esta posição não usa quantidade nem preço unitário.",
    }
  if (
    position.quantity !== undefined &&
    (quantity === undefined || unitPrice === undefined)
  )
    return {
      ok: false,
      field: quantity === undefined ? "quantity" : "unitPrice",
      message: "Informe quantidade e preço unitário da posição.",
    }
  if (quantity !== undefined && quantity !== position.quantity)
    return {
      ok: false,
      field: "quantity",
      message: "A quantidade deve corresponder à posição atual.",
    }
  return {
    ok: true,
    draft: {
      bookId,
      requestId,
      positionId: position.id,
      expectedAllocationRevision: position.allocationRevision,
      valuedAt,
      grossValueMinor,
      ...(netValueMinor === undefined ? {} : { netValueMinor }),
      ...(withdrawableValueMinor === undefined
        ? {}
        : { withdrawableValueMinor }),
      ...(quantity === undefined ? {} : { quantity }),
      ...(unitPrice === undefined ? {} : { unitPrice }),
    },
  }
}

export function valuationErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "INVESTMENT_ALLOCATION_CHANGED":
      return "A posição mudou. Recarregue a posição e informe uma nova avaliação."
    case "INVALID_INVESTMENT_VALUATION":
      return "A avaliação não corresponde à posição atual. Revise os valores e a quantidade."
    case "INVALID_INVESTMENT_DATE":
      return "O instante da avaliação não pode estar no futuro."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar a avaliação. Os dados foram preservados; tente novamente."
  }
}
