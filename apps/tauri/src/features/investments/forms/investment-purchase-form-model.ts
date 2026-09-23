import type {
  InvestmentPositionView,
  PurchaseOrApplicationDraft,
} from "@workspace/application"
import { z } from "zod"
import {
  parseOpeningMoney,
  parseOpeningQuantity,
} from "./open-investment-position-form-model"

export const purchaseFormSchema = z.object({
  fundingMode: z.enum(["INTERNAL_CASH", "EXTERNAL_ACCOUNT"]),
  externalAccountId: z.string(),
  capitalDisplay: z.string(),
  quantity: z.string(),
  feesDisplay: z.string(),
  taxesDisplay: z.string(),
  feeCategoryId: z.string(),
  taxCategoryId: z.string(),
  occurredOn: z.string(),
  description: z.string(),
})

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>

export const purchaseFormDefaults: PurchaseFormValues = {
  fundingMode: "INTERNAL_CASH",
  externalAccountId: "",
  capitalDisplay: "",
  quantity: "",
  feesDisplay: "0",
  taxesDisplay: "0",
  feeCategoryId: "",
  taxCategoryId: "",
  occurredOn: "",
  description: "",
}

type ValidationResult =
  | { readonly ok: true; readonly draft: PurchaseOrApplicationDraft }
  | {
      readonly ok: false
      readonly field: keyof PurchaseFormValues
      readonly message: string
    }

export function buildPurchaseDraft(input: {
  readonly values: PurchaseFormValues
  readonly position: InvestmentPositionView
  readonly bookId: string
  readonly requestId: string
  readonly externalAccountIds: readonly string[]
  readonly expenseCategoryIds: readonly string[]
}): ValidationResult {
  const {
    values,
    position,
    bookId,
    requestId,
    externalAccountIds,
    expenseCategoryIds,
  } = input
  const capitalMinor = parseOpeningMoney(values.capitalDisplay)
  if (capitalMinor === null || capitalMinor === "0")
    return {
      ok: false,
      field: "capitalDisplay",
      message: "Informe um principal maior que zero.",
    }

  const quantityDelta =
    position.quantity === undefined
      ? undefined
      : parseOpeningQuantity(values.quantity)
  if (quantityDelta === null)
    return { ok: false, field: "quantity", message: "Informe a quantidade." }

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
    values.fundingMode === "EXTERNAL_ACCOUNT" &&
    !externalAccountIds.includes(values.externalAccountId)
  )
    return {
      ok: false,
      field: "externalAccountId",
      message: "Escolha a conta de origem.",
    }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.occurredOn) ||
    Number.isNaN(Date.parse(`${values.occurredOn}T00:00:00Z`))
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
      type: position.assetClass === "FIXED_INCOME" ? "APPLICATION" : "PURCHASE",
      currency: position.currency,
      occurredOn: values.occurredOn,
      description:
        values.description.trim() ||
        (position.assetClass === "FIXED_INCOME" ? "Aplicação" : "Compra"),
      capitalMinor,
      funding:
        values.fundingMode === "EXTERNAL_ACCOUNT"
          ? { mode: "EXTERNAL_ACCOUNT", accountId: values.externalAccountId }
          : { mode: "INTERNAL_CASH" },
      ...(quantityDelta === undefined ? {} : { quantityDelta }),
      ...(feesMinor === "0"
        ? {}
        : { feesMinor, feeCategoryId: values.feeCategoryId }),
      ...(taxesMinor === "0"
        ? {}
        : { taxesMinor, taxCategoryId: values.taxCategoryId }),
    },
  }
}

export function purchaseErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "A posição mudou. Atualize a posição e revise a compra/aplicação."
    case "INVALID_INVESTMENT_CATEGORY":
      return "A categoria mudou. Atualize as categorias e revise a operação."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar a operação. Os dados foram preservados; tente novamente."
  }
}
