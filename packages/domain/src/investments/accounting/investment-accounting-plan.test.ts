import { describe, expect, it } from "vitest"
import { planInvestmentAccounting } from "./investment-accounting-plan.js"
import type { InvestmentAccountingPlanInput } from "./investment-accounting-plan.js"

const accounts = {
  investmentAccountId: "investment",
  externalAccountId: "bank",
  gainCategoryId: "gain",
  lossCategoryId: "loss",
  incomeCategoryId: "income",
  feeCategoryId: "fee",
  taxCategoryId: "tax",
}

function plan(overrides: Partial<InvestmentAccountingPlanInput>) {
  return planInvestmentAccounting({
    type: "PURCHASE",
    capitalMinor: "1000",
    grossAmountMinor: "0",
    cashMode: "EXTERNAL_ACCOUNT",
    accounts,
    ...overrides,
  })
}

describe("planInvestmentAccounting", () => {
  it.each([
    ["opening allocation", { type: "OPENING_ALLOCATION", capitalMinor: "4000", grossAmountMinor: "0", cashMode: "NONE" }, "4000", "0", []],
    ["external purchase", {}, "1000", "-1000", [["bank", "-1000"], ["investment", "1000"]]],
    ["external purchase fees", { feesMinor: "10", taxesMinor: "5" }, "1000", "-1015", [["bank", "-1015"], ["investment", "1000"], ["fee", "10"], ["tax", "5"]]],
    ["internal application", { type: "APPLICATION", cashMode: "INTERNAL_CASH" }, "1000", "-1000", []],
    ["sale gain internal", { type: "SALE", capitalMinor: "4000", grossAmountMinor: "4500", cashMode: "INTERNAL_CASH" }, "-4000", "4500", [["investment", "500"], ["gain", "-500"]]],
    ["sale loss internal", { type: "SALE", capitalMinor: "4000", grossAmountMinor: "3500", cashMode: "INTERNAL_CASH" }, "-4000", "3500", [["investment", "-500"], ["loss", "500"]]],
    ["sale internal expense", { type: "SALE", capitalMinor: "4000", grossAmountMinor: "4500", feesMinor: "20", taxesMinor: "30", cashMode: "INTERNAL_CASH" }, "-4000", "4450", [["investment", "450"], ["gain", "-500"], ["fee", "20"], ["tax", "30"]]],
    ["sale external expense", { type: "SALE", capitalMinor: "4000", grossAmountMinor: "4500", feesMinor: "20", taxesMinor: "30", cashMode: "EXTERNAL_ACCOUNT" }, "-4000", "4450", [["bank", "4450"], ["investment", "-4000"], ["gain", "-500"], ["fee", "20"], ["tax", "30"]]],
    ["sale at cost no journal", { type: "SALE", capitalMinor: "1000", grossAmountMinor: "1000", cashMode: "INTERNAL_CASH" }, "-1000", "1000", []],
    ["sale at cost expenses", { type: "SALE", capitalMinor: "1000", grossAmountMinor: "1000", feesMinor: "10", cashMode: "INTERNAL_CASH" }, "-1000", "990", [["investment", "-10"], ["fee", "10"]]],
    ["redemption", { type: "REDEMPTION", capitalMinor: "5000", grossAmountMinor: "5100", taxesMinor: "20", cashMode: "EXTERNAL_ACCOUNT" }, "-5000", "5080", [["bank", "5080"], ["investment", "-5000"], ["gain", "-100"], ["tax", "20"]]],
    ["amortization", { type: "AMORTIZATION", capitalMinor: "200", grossAmountMinor: "220", cashMode: "INTERNAL_CASH" }, "-200", "220", [["investment", "20"], ["gain", "-20"]]],
    ["income", { type: "INCOME", capitalMinor: "0", grossAmountMinor: "100", feesMinor: "2", taxesMinor: "10", cashMode: "INTERNAL_CASH" }, "0", "88", [["investment", "88"], ["income", "-100"], ["fee", "2"], ["tax", "10"]]],
    ["fee", { type: "FEE", capitalMinor: "0", grossAmountMinor: "0", feesMinor: "10", cashMode: "INTERNAL_CASH" }, "0", "-10", [["investment", "-10"], ["fee", "10"]]],
    ["tax", { type: "TAX", capitalMinor: "0", grossAmountMinor: "0", taxesMinor: "10", cashMode: "INTERNAL_CASH" }, "0", "-10", [["investment", "-10"], ["tax", "10"]]],
  ])("uses exact deltas for %s", (_name, input, cost, cash, expected) => {
    const result = plan(input as Partial<InvestmentAccountingPlanInput>)
    expect(result.bookCostDeltaMinor).toBe(cost)
    expect(result.netCashFlowMinor).toBe(cash)
    expect(result.postings.map(({ accountId, amountMinor }) => [accountId, amountMinor])).toEqual(expected)
  })

  it.each([
    ["purchase without external account", { accounts: { ...accounts, externalAccountId: undefined } }],
    ["sale with missing gain category", { type: "SALE", capitalMinor: "1", grossAmountMinor: "2", cashMode: "INTERNAL_CASH", accounts: { ...accounts, gainCategoryId: undefined } }],
    ["loss with missing loss category", { type: "SALE", capitalMinor: "2", grossAmountMinor: "1", cashMode: "INTERNAL_CASH", accounts: { ...accounts, lossCategoryId: undefined } }],
    ["income with negative cash", { type: "INCOME", capitalMinor: "0", grossAmountMinor: "1", feesMinor: "2", cashMode: "INTERNAL_CASH" }],
    ["fee routed externally", { type: "FEE", capitalMinor: "0", grossAmountMinor: "0", feesMinor: "1", cashMode: "EXTERNAL_ACCOUNT" }],
    ["zero amortization", { type: "AMORTIZATION", capitalMinor: "0", grossAmountMinor: "1", cashMode: "INTERNAL_CASH" }],
    ["purchase without route", { cashMode: "NONE" }],
    ["decimal monetary input", { capitalMinor: "1.5" }],
    ["negative purchase", { capitalMinor: "-1" }],
  ])("rejects %s", (_name, input) => {
    expect(() => plan(input as Partial<InvestmentAccountingPlanInput>)).toThrow("Invalid investment accounting plan")
  })
})
