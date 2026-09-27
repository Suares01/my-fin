import type { InvestmentOperationHistoryItem } from "@workspace/application"

export function correctionOperation(
  type: string,
  overrides: Partial<InvestmentOperationHistoryItem> = {}
): InvestmentOperationHistoryItem {
  return {
    id: "operation-original",
    type,
    role: "BUSINESS",
    version: 0,
    occurredOn: "2026-09-01",
    recordedAt: "2026-09-01T12:00:00.000Z",
    sequence: "3",
    description: "Operação original",
    currency: "BRL",
    grossAmountMinor: "0",
    netCashFlowMinor: "0",
    bookCostDeltaMinor: "0",
    feesMinor: "0",
    taxesMinor: "0",
    cashMode: "INTERNAL_CASH",
    beforeKind: "EXISTING",
    beforeBookCostMinor: "500000",
    beforeStatus: "OPEN",
    ...overrides,
  }
}
