import { describe, expect, expectTypeOf, it } from "vitest"
import type {
  InvestmentMutationResult,
  InvestmentOperationDraft,
  InvestmentRequestReceipt,
  InvestmentWarning,
  PurchaseOrApplicationDraft,
} from "./investment-commands.js"

const base = { bookId: "book-1", requestId: "request-1", positionId: "position-1", expectedPositionVersion: 2, occurredOn: "2026-09-10", description: "Purchase", currency: "BRL" }

describe("investment command contracts", () => {
  it("carries a stable request envelope", () => expect(base).toMatchObject({ bookId: "book-1", requestId: "request-1" }))
  it("models internal funding without an account", () => {
    const draft: PurchaseOrApplicationDraft = { ...base, type: "PURCHASE", capitalMinor: "1000", funding: { mode: "INTERNAL_CASH" } }
    expect(draft.funding).toEqual({ mode: "INTERNAL_CASH" })
  })
  it("models external funding with its explicit account", () => {
    const draft: PurchaseOrApplicationDraft = { ...base, type: "APPLICATION", capitalMinor: "1000", funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" } }
    expect(draft.funding).toEqual({ mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" })
  })
  it("keeps sale cost distinct from gross proceeds", () => {
    const draft: InvestmentOperationDraft = { ...base, type: "SALE", bookCostReductionMinor: "400", grossProceedsMinor: "500", destination: { mode: "INTERNAL_CASH" } }
    expect(draft).toMatchObject({ bookCostReductionMinor: "400", grossProceedsMinor: "500" })
  })
  it("limits income to internal cash", () => {
    const draft: InvestmentOperationDraft = { ...base, type: "INCOME", grossAmountMinor: "100", cashMode: "INTERNAL_CASH" }
    expect(draft.cashMode).toBe("INTERNAL_CASH")
  })
  it("uses an explicit expense category for fee", () => {
    const draft: InvestmentOperationDraft = { ...base, type: "FEE", amountMinor: "10", expenseCategoryId: "fee-1", cashMode: "INTERNAL_CASH" }
    expect(draft).toMatchObject({ amountMinor: "10", expenseCategoryId: "fee-1" })
  })
  it("returns every negative-cash warning field", () => {
    const warning: InvestmentWarning = { code: "INVESTMENT_CASH_NEGATIVE", investmentAccountId: "investment-1", cashMinor: "-100", currency: "BRL", asOf: "2026-09-10" }
    expect(warning).toEqual({ code: "INVESTMENT_CASH_NEGATIVE", investmentAccountId: "investment-1", cashMinor: "-100", currency: "BRL", asOf: "2026-09-10" })
  })
  it("preserves a replayable mutation result in a versioned receipt", () => {
    const result: InvestmentMutationResult = { requestId: "request-1", positionId: "position-1", journalEntryIds: ["journal-1"], warnings: [] }
    const receipt: InvestmentRequestReceipt = { bookId: "book-1", requestId: "request-1", formatVersion: 1, canonicalCommand: "{}", result, recordedAt: "2026-09-10T12:00:00.000Z" }
    expect(receipt).toMatchObject({ formatVersion: 1, result: { positionId: "position-1", journalEntryIds: ["journal-1"] } })
  })
  it("excludes arbitrary postings from operation drafts", () => {
    expectTypeOf<InvestmentOperationDraft>().not.toHaveProperty("postings")
  })
})
