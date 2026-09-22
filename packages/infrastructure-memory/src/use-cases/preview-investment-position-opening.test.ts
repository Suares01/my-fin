import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateInvestmentInstrument,
  OpenInvestmentPositionWithPurchase,
  PreviewInvestmentPositionOpening,
  SetInvestmentOpeningBalance,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  for (const [name, type] of [
    ["Broker", "INVESTMENT_ACCOUNT"],
    ["Bank", "BANK_ACCOUNT"],
  ] as const) {
    const result = await new CreateFinancialAccount(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({ bookId: "book-1", name, type })
    if (!result.ok) throw new Error("account fixture failed")
  }
  for (const name of ["Fee", "Tax"]) {
    const result = await new CreateExpenseCategory(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({
      bookId: "book-1",
      name,
      kind: "EXPENSE",
      iconKey: "receipt",
      colorHex: "f43f5e",
    })
    if (!result.ok) throw new Error("category fixture failed")
  }
  const result = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!result.ok) throw new Error("instrument fixture failed")
  h.publisher.clear()
  return h
}

const allocation = {
  kind: "ALLOCATION",
  bookId: "book-1",
  investmentAccountId: "account-5",
  instrumentId: "instrument-1",
  quantityMode: "AMOUNT",
  bookCostMinor: "1000",
  occurredOn: "2026-08-04",
} as const

const purchase = {
  kind: "PURCHASE",
  bookId: "book-1",
  investmentAccountId: "account-5",
  instrumentId: "instrument-1",
  quantityMode: "UNITS",
  quantityDelta: "10",
  type: "PURCHASE",
  occurredOn: "2026-08-04",
  description: "Initial purchase",
  currency: "BRL",
  capitalMinor: "1000",
  funding: { mode: "INTERNAL_CASH" },
} as const

function preview(h: Awaited<ReturnType<typeof setup>>) {
  return new PreviewInvestmentPositionOpening(h.transactionManager)
}

describe("PreviewInvestmentPositionOpening", () => {
  it("projects an internal opening allocation without postings", async () => {
    const h = await setup()
    expect(await preview(h).execute(allocation)).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "1000",
        netCashFlowMinor: "0",
        postings: [],
        categories: {},
        projectedCashMinor: "-1000",
      },
    })
  })

  it("projects an initial internal purchase with the same planner", async () => {
    const h = await setup()
    expect(await preview(h).execute(purchase)).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "1000",
        netCashFlowMinor: "-1000",
        postings: [],
        projectedCashMinor: "-1000",
      },
    })
  })

  it("projects external application principal and expenses in one balanced posting set", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({
        ...purchase,
        type: "APPLICATION",
        funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-6" },
        feesMinor: "10",
        taxesMinor: "5",
        feeCategoryId: "account-7",
        taxCategoryId: "account-8",
      })
    ).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "1000",
        netCashFlowMinor: "-1015",
        categories: { feeCategoryId: "account-7", taxCategoryId: "account-8" },
        projectedCashMinor: "0",
        postings: expect.arrayContaining([
          { accountId: "account-6", amountMinor: "-1015" },
          { accountId: "account-5", amountMinor: "1000" },
          { accountId: "account-7", amountMinor: "10" },
          { accountId: "account-8", amountMinor: "5" },
        ]),
      },
    })
  })

  it("projects explicit missing-wealth opening balance plus real cash, not valuation", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({
        ...allocation,
        proposedOpeningBalanceMinor: "1500",
      })
    ).toMatchObject({
      ok: true,
      value: {
        openingBalanceMinor: "1500",
        bookCostDeltaMinor: "1000",
        projectedCashMinor: "500",
        warnings: [],
      },
    })
  })

  it("rejects a second active opening balance without changing the first", async () => {
    const h = await setup()
    const set = new SetInvestmentOpeningBalance(
      h.transactionManager,
      h.dispatcher,
      h.ids,
      h.clock
    )
    await set.execute({
      bookId: "book-1",
      requestId: "first",
      accountId: "account-5",
      amountMinor: "1500",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Opening",
    })
    const before = h.store.snapshot()
    expect(
      await preview(h).execute({
        ...allocation,
        proposedOpeningBalanceMinor: "1500",
      })
    ).toMatchObject({
      ok: false,
      error: { code: "OPENING_BALANCE_ALREADY_SET" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })

  it("keeps negative cash as a valid preview warning", async () => {
    const h = await setup()
    expect(await preview(h).execute(allocation)).toMatchObject({
      ok: true,
      value: {
        projectedCashMinor: "-1000",
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "account-5",
            cashMinor: "-1000",
            currency: "BRL",
            asOf: "2026-08-04",
          },
        ],
      },
    })
  })

  it("requires known book cost rather than an estimated valuation", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({
        ...allocation,
        bookCostMinor: undefined as never,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_BOOK_COST_REQUIRED" },
    })
  })

  it("validates quantity and partial fixed-income terms before preview", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({
        ...purchase,
        quantityDelta: undefined as never,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(
      await preview(h).execute({
        ...allocation,
        fixedIncomeTerms: { maturityDate: "2028-08-04" },
      })
    ).toMatchObject({ ok: true })
    expect(
      await preview(h).execute({
        ...allocation,
        fixedIncomeTerms: {
          issueDate: "2028-08-04",
          maturityDate: "2027-08-04",
        },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_FIXED_INCOME_TERMS" },
    })
  })

  it("rejects cross-book and currency mismatch without reading another book's entity", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({ ...purchase, bookId: "other-book" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(
      await preview(h).execute({ ...purchase, currency: "USD" })
    ).toMatchObject({ ok: false, error: { code: "CURRENCY_MISMATCH" } })
  })

  it("rejects missing funding route and expense category before producing a preview", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({ ...purchase, funding: undefined as never })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(
      await preview(h).execute({ ...purchase, feesMinor: "10" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("rejects non-investment accounts and unavailable instruments", async () => {
    const h = await setup()
    expect(
      await preview(h).execute({
        ...allocation,
        investmentAccountId: "account-6",
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_ENTITY_NOT_ACTIVE" },
    })
    expect(
      await preview(h).execute({ ...allocation, instrumentId: "missing" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
  })

  it("does not persist a position, operation, journal, receipt, fact, ID or sequence", async () => {
    const h = await setup()
    const externalPurchase = {
      ...purchase,
      funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-6" },
    } as const
    const before = h.store.snapshot()
    const facts = h.publisher.events.length
    expect(await preview(h).execute(externalPurchase)).toMatchObject({
      ok: true,
    })
    expect(h.store.snapshot()).toEqual(before)
    expect(h.publisher.events).toHaveLength(facts)
    expect(
      await new OpenInvestmentPositionWithPurchase(
        h.transactionManager,
        h.dispatcher,
        h.ids,
        h.clock
      ).execute({ ...externalPurchase, requestId: "confirm" })
    ).toMatchObject({
      ok: true,
      value: {
        positionId: "position-1",
        operationId: "operation-1",
        journalEntryIds: ["entry-1"],
      },
    })
    expect(h.store.listJournalEntries()[0]?.sequence).toBe("1")
  })
})
