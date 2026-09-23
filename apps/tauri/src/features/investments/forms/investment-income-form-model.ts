import type {
  IncomeDraft,
  InvestmentPositionView,
} from "@workspace/application"
import { z } from "zod"
import { parseOpeningMoney } from "./open-investment-position-form-model"

export const incomeFormSchema = z.object({
  grossDisplay: z.string(),
  feesDisplay: z.string(),
  taxesDisplay: z.string(),
  incomeCategoryId: z.string(),
  feeCategoryId: z.string(),
  taxCategoryId: z.string(),
  occurredOn: z.string(),
  description: z.string(),
})

export type IncomeFormValues = z.infer<typeof incomeFormSchema>

export const incomeFormDefaults: IncomeFormValues = {
  grossDisplay: "",
  feesDisplay: "0",
  taxesDisplay: "0",
  incomeCategoryId: "",
  feeCategoryId: "",
  taxCategoryId: "",
  occurredOn: "",
  description: "",
}

type ValidationResult =
  | { readonly ok: true; readonly draft: IncomeDraft }
  | {
      readonly ok: false
      readonly field: keyof IncomeFormValues
      readonly message: string
    }

export function buildIncomeDraft(input: {
  readonly values: IncomeFormValues
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
  const grossAmountMinor = parseOpeningMoney(values.grossDisplay)
  if (grossAmountMinor === null || grossAmountMinor === "0")
    return {
      ok: false,
      field: "grossDisplay",
      message: "Informe um valor bruto maior que zero.",
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
  if (BigInt(grossAmountMinor) < BigInt(feesMinor) + BigInt(taxesMinor))
    return {
      ok: false,
      field: "grossDisplay",
      message: "O valor líquido não pode ser negativo.",
    }
  if (!incomeCategoryIds.includes(values.incomeCategoryId))
    return {
      ok: false,
      field: "incomeCategoryId",
      message: "Escolha a categoria de rendimento.",
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
      type: "INCOME",
      currency: position.currency,
      occurredOn: values.occurredOn,
      description: values.description.trim() || "Rendimento",
      grossAmountMinor,
      incomeCategoryId: values.incomeCategoryId,
      cashMode: "INTERNAL_CASH",
      ...(feesMinor === "0"
        ? {}
        : { feesMinor, feeCategoryId: values.feeCategoryId }),
      ...(taxesMinor === "0"
        ? {}
        : { taxesMinor, taxCategoryId: values.taxCategoryId }),
    },
  }
}

export function incomeErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "A posição mudou. Atualize a posição e revise o rendimento."
    case "INVALID_INVESTMENT_CATEGORY":
      return "A categoria mudou. Atualize as categorias e revise o rendimento."
    case "INVESTMENT_ENTITY_NOT_ACTIVE":
      return "A conta ou o instrumento foi arquivado. Atualize a posição antes de continuar."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar o rendimento. Os dados foram preservados; tente novamente."
  }
}
