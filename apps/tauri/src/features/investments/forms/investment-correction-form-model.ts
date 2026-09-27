import type {
  InvestmentOperationHistoryItem,
  InvestmentPositionView,
} from "@workspace/application"
import type { PurchaseFormValues } from "./investment-purchase-form-model"
import type { SaleFormValues } from "./investment-sale-form-model"
import type { IncomeFormValues } from "./investment-income-form-model"
import type { AmortizationFormValues } from "./investment-amortization-form-model"
import type { ExpenseFormValues } from "./investment-expense-form-model"
import { minorToSaleInput } from "./investment-sale-form-model"

export type InvestmentAmendment = {
  readonly operation: InvestmentOperationHistoryItem
  readonly reason: string
}

export function correctionPosition(
  position: InvestmentPositionView,
  operation: InvestmentOperationHistoryItem
): InvestmentPositionView {
  if (
    operation.beforeKind !== "EXISTING" ||
    operation.beforeBookCostMinor === undefined ||
    operation.beforeStatus === undefined
  )
    throw new Error("A operação não possui estado anterior para substituição.")
  return {
    ...position,
    quantity: operation.beforeQuantity,
    bookCostMinor: operation.beforeBookCostMinor,
    status: operation.beforeStatus,
  }
}

export function correctableOperation(
  operation: InvestmentOperationHistoryItem,
  lastEffectiveOperationId: string
): boolean {
  return (
    operation.id === lastEffectiveOperationId &&
    operation.role === "BUSINESS" &&
    operation.reversedBy === undefined &&
    operation.replacedBy === undefined
  )
}

export function correctionErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { readonly code?: unknown }).code
      : undefined
  switch (code) {
    case "OPTIMISTIC_CONCURRENCY_FAILURE":
    case "INVESTMENT_OPERATION_NOT_CORRECTABLE":
      return "A operação mudou. Recarregue o histórico e reaplique a correção."
    case "INVESTMENT_ENTITY_NOT_ACTIVE":
      return "Reative a carteira e o instrumento antes de corrigir esta operação."
    case "INVALID_INVESTMENT_DATE":
      return "A data da substituição é inválida. Revise a data informada."
    default:
      return "Não foi possível corrigir a operação. Os dados foram preservados; tente novamente."
  }
}

const amount = (minor: string) => minorToSaleInput(minor)
const reducedCost = (operation: InvestmentOperationHistoryItem) =>
  amount((-BigInt(operation.bookCostDeltaMinor)).toString())
const cashRoute = (operation: InvestmentOperationHistoryItem) =>
  operation.cashMode === "EXTERNAL_ACCOUNT"
    ? "EXTERNAL_ACCOUNT"
    : "INTERNAL_CASH"

export function purchaseCorrectionDefaults(
  operation: InvestmentOperationHistoryItem
): PurchaseFormValues {
  return {
    fundingMode: cashRoute(operation),
    externalAccountId: operation.settlementAccountId ?? "",
    capitalDisplay: amount(operation.bookCostDeltaMinor),
    quantity: operation.quantityDelta ?? "",
    feesDisplay: amount(operation.feesMinor),
    taxesDisplay: amount(operation.taxesMinor),
    feeCategoryId: operation.feeCategoryId ?? "",
    taxCategoryId: operation.taxCategoryId ?? "",
    occurredOn: operation.occurredOn,
    description: operation.description,
  }
}
export function saleCorrectionDefaults(
  operation: InvestmentOperationHistoryItem
): SaleFormValues {
  return {
    scope: "PARTIAL",
    destinationMode: cashRoute(operation),
    externalAccountId: operation.settlementAccountId ?? "",
    costDisplay: reducedCost(operation),
    quantity: operation.quantityDelta?.replace(/^-/, "") ?? "",
    grossDisplay: amount(operation.grossAmountMinor),
    feesDisplay: amount(operation.feesMinor),
    taxesDisplay: amount(operation.taxesMinor),
    gainCategoryId: operation.gainCategoryId ?? "",
    lossCategoryId: operation.lossCategoryId ?? "",
    feeCategoryId: operation.feeCategoryId ?? "",
    taxCategoryId: operation.taxCategoryId ?? "",
    occurredOn: operation.occurredOn,
    description: operation.description,
  }
}
export function incomeCorrectionDefaults(
  operation: InvestmentOperationHistoryItem
): IncomeFormValues {
  return {
    grossDisplay: amount(operation.grossAmountMinor),
    feesDisplay: amount(operation.feesMinor),
    taxesDisplay: amount(operation.taxesMinor),
    incomeCategoryId: operation.incomeCategoryId ?? "",
    feeCategoryId: operation.feeCategoryId ?? "",
    taxCategoryId: operation.taxCategoryId ?? "",
    occurredOn: operation.occurredOn,
    description: operation.description,
  }
}
export function amortizationCorrectionDefaults(
  operation: InvestmentOperationHistoryItem
): AmortizationFormValues {
  return {
    costDisplay: reducedCost(operation),
    grossDisplay: amount(operation.grossAmountMinor),
    feesDisplay: amount(operation.feesMinor),
    taxesDisplay: amount(operation.taxesMinor),
    gainCategoryId: operation.gainCategoryId ?? "",
    lossCategoryId: operation.lossCategoryId ?? "",
    feeCategoryId: operation.feeCategoryId ?? "",
    taxCategoryId: operation.taxCategoryId ?? "",
    occurredOn: operation.occurredOn,
    description: operation.description,
  }
}
export function expenseCorrectionDefaults(
  operation: InvestmentOperationHistoryItem
): ExpenseFormValues {
  const isTax = operation.type === "TAX"
  return {
    type: isTax ? "TAX" : "FEE",
    amountDisplay: amount(isTax ? operation.taxesMinor : operation.feesMinor),
    expenseCategoryId:
      (isTax ? operation.taxCategoryId : operation.feeCategoryId) ?? "",
    occurredOn: operation.occurredOn,
    description: operation.description,
  }
}
