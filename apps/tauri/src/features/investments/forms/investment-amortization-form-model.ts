import type {
  AmortizationDraft,
  InvestmentPositionView,
} from "@workspace/application"
import { z } from "zod"
import { parseOpeningMoney } from "./open-investment-position-form-model"

export const amortizationFormSchema = z.object({
  costDisplay: z.string(),
  grossDisplay: z.string(),
  feesDisplay: z.string(),
  taxesDisplay: z.string(),
  gainCategoryId: z.string(),
  lossCategoryId: z.string(),
  feeCategoryId: z.string(),
  taxCategoryId: z.string(),
  occurredOn: z.string(),
  description: z.string(),
})

export type AmortizationFormValues = z.infer<typeof amortizationFormSchema>

export const amortizationFormDefaults: AmortizationFormValues = {
  costDisplay: "",
  grossDisplay: "",
  feesDisplay: "0",
  taxesDisplay: "0",
  gainCategoryId: "",
  lossCategoryId: "",
  feeCategoryId: "",
  taxCategoryId: "",
  occurredOn: "",
  description: "",
}

export function amortizationGrossResult(
  values: AmortizationFormValues
): bigint | null {
  const cost = parseOpeningMoney(values.costDisplay)
  const gross = parseOpeningMoney(values.grossDisplay)
  return cost === null || gross === null ? null : BigInt(gross) - BigInt(cost)
}

type ValidationResult =
  | { readonly ok: true; readonly draft: AmortizationDraft }
  | {
      readonly ok: false
      readonly field: keyof AmortizationFormValues
      readonly message: string
    }

export function buildAmortizationDraft(input: {
  readonly values: AmortizationFormValues
  readonly position: InvestmentPositionView
  readonly bookId: string
  readonly requestId: string
  readonly incomeCategoryIds: readonly string[]
  readonly expenseCategoryIds: readonly string[]
}): ValidationResult {
  const {
    values,
    position,
    bookId,
    requestId,
    incomeCategoryIds,
    expenseCategoryIds,
  } = input
  if (position.status !== "OPEN")
    return {
      ok: false,
      field: "costDisplay",
      message: "Amortização exige uma posição aberta.",
    }
  const bookCostReductionMinor = parseOpeningMoney(values.costDisplay)
  if (bookCostReductionMinor === null || bookCostReductionMinor === "0")
    return {
      ok: false,
      field: "costDisplay",
      message: "Informe um custo reduzido maior que zero.",
    }
  if (BigInt(bookCostReductionMinor) > BigInt(position.bookCostMinor))
    return {
      ok: false,
      field: "costDisplay",
      message: "O custo reduzido excede o custo da posição.",
    }
  const grossProceedsMinor = parseOpeningMoney(values.grossDisplay)
  if (grossProceedsMinor === null)
    return {
      ok: false,
      field: "grossDisplay",
      message: "Informe o valor bruto recebido, inclusive zero.",
    }
  const feesMinor = parseOpeningMoney(values.feesDisplay)
  if (feesMinor === null)
    return {
      ok: false,
      field: "feesDisplay",
      message: "Informe taxas válidas.",
    }
  const taxesMinor = parseOpeningMoney(values.taxesDisplay)
  if (taxesMinor === null)
    return {
      ok: false,
      field: "taxesDisplay",
      message: "Informe impostos válidos.",
    }
  if (BigInt(grossProceedsMinor) < BigInt(feesMinor) + BigInt(taxesMinor))
    return {
      ok: false,
      field: "grossDisplay",
      message: "O valor líquido não pode ser negativo.",
    }
  const grossResult =
    BigInt(grossProceedsMinor) - BigInt(bookCostReductionMinor)
  if (grossResult > 0n && !incomeCategoryIds.includes(values.gainCategoryId))
    return {
      ok: false,
      field: "gainCategoryId",
      message: "Escolha a categoria de ganho.",
    }
  if (grossResult < 0n && !expenseCategoryIds.includes(values.lossCategoryId))
    return {
      ok: false,
      field: "lossCategoryId",
      message: "Escolha a categoria de perda.",
    }
  if (feesMinor !== "0" && !expenseCategoryIds.includes(values.feeCategoryId))
    return {
      ok: false,
      field: "feeCategoryId",
      message: "Escolha a categoria de taxas.",
    }
  if (taxesMinor !== "0" && !expenseCategoryIds.includes(values.taxCategoryId))
    return {
      ok: false,
      field: "taxCategoryId",
      message: "Escolha a categoria de impostos.",
    }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.occurredOn) ||
    Number.isNaN(Date.parse(values.occurredOn + "T00:00:00Z"))
  )
    return {
      ok: false,
      field: "occurredOn",
      message: "Informe uma data válida.",
    }

  return {
    ok: true,
    draft: {
      bookId,
      requestId,
      positionId: position.id,
      expectedPositionVersion: position.version,
      type: "AMORTIZATION",
      currency: position.currency,
      occurredOn: values.occurredOn,
      description: values.description.trim() || "Amortização",
      bookCostReductionMinor,
      grossProceedsMinor,
      cashMode: "INTERNAL_CASH",
      ...(grossResult > 0n ? { gainCategoryId: values.gainCategoryId } : {}),
      ...(grossResult < 0n ? { lossCategoryId: values.lossCategoryId } : {}),
      ...(feesMinor === "0"
        ? {}
        : { feesMinor, feeCategoryId: values.feeCategoryId }),
      ...(taxesMinor === "0"
        ? {}
        : { taxesMinor, taxCategoryId: values.taxCategoryId }),
    },
  }
}

export function amortizationErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "A posição mudou. Atualize a posição e revise a amortização."
    case "INVALID_INVESTMENT_CATEGORY":
      return "A categoria mudou. Atualize as categorias e revise a amortização."
    case "INVALID_INVESTMENT_OPERATION":
      return "A amortização não é mais válida. Atualize a posição e revise custo e valores."
    case "INVESTMENT_ENTITY_NOT_ACTIVE":
      return "A posição, conta ou instrumento não está ativo. Atualize a posição antes de continuar."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar a amortização. Os dados foram preservados; tente novamente."
  }
}
