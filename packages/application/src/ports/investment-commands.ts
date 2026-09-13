export interface InvestmentRequest {
  readonly bookId: string
  readonly requestId: string
}

export interface InvestmentWarning {
  readonly code: "INVESTMENT_CASH_NEGATIVE"
  readonly investmentAccountId: string
  readonly cashMinor: string
  readonly currency: string
  readonly asOf: string
}

export interface InvestmentMutationResult {
  readonly requestId: string
  readonly positionId?: string
  readonly positionVersion?: number
  readonly allocationRevision?: number
  readonly operationId?: string
  readonly reversalOperationId?: string
  readonly replacementOperationId?: string
  readonly valuationId?: string
  readonly journalEntryIds: readonly string[]
  readonly warnings: readonly InvestmentWarning[]
}

export interface InvestmentRequestReceipt {
  readonly bookId: string
  readonly requestId: string
  readonly formatVersion: 1
  readonly canonicalCommand: string
  readonly result: InvestmentMutationResult
  readonly recordedAt: string
}

export type CashRoute =
  | { readonly mode: "INTERNAL_CASH" }
  | { readonly mode: "EXTERNAL_ACCOUNT"; readonly accountId: string }

export interface InvestmentOperationDateInput {
  readonly occurredOn: string
  readonly settledOn?: string
  readonly description: string
  readonly currency: string
}

export interface InvestmentOperationBase
  extends InvestmentRequest, InvestmentOperationDateInput {
  readonly positionId: string
  readonly expectedPositionVersion: number
}

export interface PurchaseOrApplicationDraft extends InvestmentOperationBase {
  readonly type: "PURCHASE" | "APPLICATION"
  readonly quantityDelta?: string
  readonly capitalMinor: string
  readonly feesMinor?: string
  readonly taxesMinor?: string
  readonly funding: CashRoute
  readonly feeCategoryId?: string
  readonly taxCategoryId?: string
}

export interface SaleOrRedemptionDraft extends InvestmentOperationBase {
  readonly type: "SALE" | "REDEMPTION"
  readonly quantityDelta?: string
  readonly bookCostReductionMinor: string
  readonly grossProceedsMinor: string
  readonly feesMinor?: string
  readonly taxesMinor?: string
  readonly destination: CashRoute
  readonly gainCategoryId?: string
  readonly lossCategoryId?: string
  readonly feeCategoryId?: string
  readonly taxCategoryId?: string
}

export interface IncomeDraft extends InvestmentOperationBase {
  readonly type: "INCOME"
  readonly grossAmountMinor: string
  readonly feesMinor?: string
  readonly taxesMinor?: string
  readonly incomeCategoryId?: string
  readonly feeCategoryId?: string
  readonly taxCategoryId?: string
  readonly cashMode: "INTERNAL_CASH"
}

export interface AmortizationDraft extends InvestmentOperationBase {
  readonly type: "AMORTIZATION"
  readonly bookCostReductionMinor: string
  readonly grossProceedsMinor: string
  readonly feesMinor?: string
  readonly taxesMinor?: string
  readonly cashMode: "INTERNAL_CASH"
  readonly gainCategoryId?: string
  readonly lossCategoryId?: string
  readonly feeCategoryId?: string
  readonly taxCategoryId?: string
}

export interface FeeOrTaxDraft extends InvestmentOperationBase {
  readonly type: "FEE" | "TAX"
  readonly amountMinor: string
  readonly expenseCategoryId: string
  readonly cashMode: "INTERNAL_CASH"
}

export type InvestmentOperationDraft =
  | PurchaseOrApplicationDraft
  | SaleOrRedemptionDraft
  | IncomeDraft
  | AmortizationDraft
  | FeeOrTaxDraft

export interface OpenInvestmentPositionCommand extends InvestmentRequest {
  readonly investmentAccountId: string
  readonly instrumentId: string
  readonly label?: string
  readonly quantityMode: "UNITS" | "AMOUNT"
  readonly quantity?: string
  readonly bookCostMinor: string
  readonly occurredOn: string
  readonly fixedIncomeTerms?: unknown
}

export interface RecordInvestmentValuationCommand extends InvestmentRequest {
  readonly positionId: string
  readonly expectedAllocationRevision: number
  readonly valuedAt: string
  readonly quantity?: string
  readonly unitPrice?: string
  readonly grossValueMinor: string
  readonly netValueMinor?: string
  readonly withdrawableValueMinor?: string
}

export interface CorrectInvestmentOperationCommand extends InvestmentRequest {
  readonly operationId: string
  readonly expectedOperationVersion: number
  readonly expectedPositionVersion: number
  readonly reason: string
}

export interface AmendInvestmentOperationCommand extends CorrectInvestmentOperationCommand {
  readonly replacement: InvestmentOperationDraft
}
