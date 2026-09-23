import type {
  InvestmentPositionView,
  SaleOrRedemptionDraft,
} from "@workspace/application"
import { z } from "zod"
import {
  parseOpeningMoney,
  parseOpeningQuantity,
} from "./open-investment-position-form-model"

export const saleFormSchema = z.object({
  scope: z.enum(["PARTIAL", "TOTAL"]),
  destinationMode: z.enum(["INTERNAL_CASH", "EXTERNAL_ACCOUNT"]),
  externalAccountId: z.string(),
  costDisplay: z.string(),
  quantity: z.string(),
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

export type SaleFormValues = z.infer<typeof saleFormSchema>

export const saleFormDefaults: SaleFormValues = {
  scope: "PARTIAL",
  destinationMode: "INTERNAL_CASH",
  externalAccountId: "",
  costDisplay: "",
  quantity: "",
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

type ValidationResult =
  | { readonly ok: true; readonly draft: SaleOrRedemptionDraft }
  | {
      readonly ok: false
      readonly field: keyof SaleFormValues
      readonly message: string
    }

export function minorToSaleInput(minor: string): string {
  const amount = BigInt(minor)
  const whole = amount / 100n
  const cents = (amount % 100n).toString().padStart(2, "0")
  return whole + "," + cents
}

function decimalUnits(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".")
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0") || "0")
}

export function buildSaleDraft(input: {
  readonly values: SaleFormValues
  readonly position: InvestmentPositionView
  readonly bookId: string
  readonly requestId: string
  readonly externalAccountIds: readonly string[]
  readonly incomeCategoryIds: readonly string[]
  readonly expenseCategoryIds: readonly string[]
}): ValidationResult {
  const {
    values,
    position,
    bookId,
    requestId,
    externalAccountIds,
    incomeCategoryIds,
    expenseCategoryIds,
  } = input
  const costMinor =
    values.scope === "TOTAL"
      ? position.bookCostMinor
      : parseOpeningMoney(values.costDisplay)
  if (costMinor === null)
    return {
      ok: false,
      field: "costDisplay",
      message: "Informe o custo retirado da parte vendida/resgatada.",
    }
  if (BigInt(costMinor) > BigInt(position.bookCostMinor))
    return {
      ok: false,
      field: "costDisplay",
      message: "O custo retirado excede o custo da posição.",
    }

  const quantityDelta =
    position.quantity === undefined
      ? undefined
      : values.scope === "TOTAL"
        ? position.quantity
        : parseOpeningQuantity(values.quantity)
  if (quantityDelta === null)
    return { ok: false, field: "quantity", message: "Informe a quantidade." }
  if (
    quantityDelta !== undefined &&
    decimalUnits(quantityDelta) > decimalUnits(position.quantity!)
  )
    return {
      ok: false,
      field: "quantity",
      message: "A quantidade excede as unidades disponíveis.",
    }
  if (
    quantityDelta !== undefined &&
    decimalUnits(quantityDelta) === decimalUnits(position.quantity!) &&
    BigInt(costMinor) < BigInt(position.bookCostMinor)
  )
    return {
      ok: false,
      field: "costDisplay",
      message: "Retire todo o custo ao vender/resgatar todas as unidades.",
    }

  const grossProceedsMinor = parseOpeningMoney(values.grossDisplay)
  if (grossProceedsMinor === null)
    return {
      ok: false,
      field: "grossDisplay",
      message: "Informe o valor bruto recebido.",
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

  const grossResult = BigInt(grossProceedsMinor) - BigInt(costMinor)
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
    values.destinationMode === "EXTERNAL_ACCOUNT" &&
    !externalAccountIds.includes(values.externalAccountId)
  )
    return {
      ok: false,
      field: "externalAccountId",
      message: "Escolha a conta de destino.",
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
      type: position.assetClass === "FIXED_INCOME" ? "REDEMPTION" : "SALE",
      currency: position.currency,
      occurredOn: values.occurredOn,
      description:
        values.description.trim() ||
        (position.assetClass === "FIXED_INCOME" ? "Resgate" : "Venda"),
      bookCostReductionMinor: costMinor,
      grossProceedsMinor,
      destination:
        values.destinationMode === "EXTERNAL_ACCOUNT"
          ? { mode: "EXTERNAL_ACCOUNT", accountId: values.externalAccountId }
          : { mode: "INTERNAL_CASH" },
      ...(quantityDelta === undefined ? {} : { quantityDelta }),
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

export function saleErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
      return "A posição mudou. Atualize a posição e revise a venda/resgate."
    case "INVALID_INVESTMENT_CATEGORY":
      return "A categoria mudou. Atualize as categorias e revise a operação."
    case "INVALID_INVESTMENT_OPERATION":
      return "A saída não é mais válida. Atualize a posição e revise custo, quantidade e valores."
    case "IDEMPOTENCY_CONFLICT":
      return "Esta tentativa já foi usada com outros dados. Revise e tente novamente."
    default:
      return "Não foi possível salvar a operação. Os dados foram preservados; tente novamente."
  }
}
