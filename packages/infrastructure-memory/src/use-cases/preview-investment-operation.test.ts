import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  PreviewInvestmentOperation,
  RecordInvestmentPurchase,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await account(h, "Broker", "INVESTMENT_ACCOUNT")
  const bank = await account(h, "Bank", "BANK_ACCOUNT")
  const gain = await category(h, "Gain", "INCOME")
  const loss = await category(h, "Loss", "EXPENSE")
  const income = await category(h, "Income", "INCOME")
  const fee = await category(h, "Fee", "EXPENSE")
  const tax = await category(h, "Tax", "EXPENSE")
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!instrument.ok) throw new Error("instrument fixture failed")
  const opening = await new OpenInvestmentPosition(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  ).execute({
    bookId: "book-1",
    requestId: "open",
    investmentAccountId: broker.id,
    instrumentId: instrument.value.id,
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    occurredOn: "2026-08-04",
  })
  if (!opening.ok) throw new Error("position fixture failed")
  h.publisher.clear()
  return { h, broker, bank, gain, loss, income, fee, tax }
}

async function account(
  h: ReturnType<typeof createHarness>,
  name: string,
  type: "INVESTMENT_ACCOUNT" | "BANK_ACCOUNT"
) {
  const result = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error("account fixture failed")
  return result.value
}

async function category(
  h: ReturnType<typeof createHarness>,
  name: string,
  kind: "INCOME" | "EXPENSE"
) {
  const Command =
    kind === "INCOME" ? CreateIncomeCategory : CreateExpenseCategory
  const result = await new Command(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({
    bookId: "book-1",
    name,
    kind,
    iconKey: "chart",
    colorHex: "10b981",
  })
  if (!result.ok) throw new Error("category fixture failed")
  return result.value
}

function preview(fixture: Awaited<ReturnType<typeof setup>>) {
  return new PreviewInvestmentOperation(fixture.h.transactionManager)
}

function purchase() {
  return {
    bookId: "book-1",
    requestId: "purchase-1",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "PURCHASE" as const,
    occurredOn: "2026-08-04",
    description: "Purchase",
    currency: "BRL",
    quantityDelta: "2",
    capitalMinor: "200",
    funding: { mode: "INTERNAL_CASH" as const },
  }
}

function sale(fixture: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1",
    requestId: "sale-1",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "SALE" as const,
    occurredOn: "2026-08-04",
    description: "Sale",
    currency: "BRL",
    quantityDelta: "4",
    bookCostReductionMinor: "400",
    grossProceedsMinor: "500",
    destination: { mode: "INTERNAL_CASH" as const },
    gainCategoryId: fixture.gain.id,
    lossCategoryId: fixture.loss.id,
    feeCategoryId: fixture.fee.id,
    taxCategoryId: fixture.tax.id,
  }
}

describe("PreviewInvestmentOperation", () => {
  it("shows the exact internal purchase cost, flow, versions, cash and warning", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({ bookId: "book-1", draft: purchase() })
    ).toEqual({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 0,
        allocationRevision: 1,
        bookCostDeltaMinor: "200",
        netCashFlowMinor: "-200",
        postings: [],
        categories: {},
        projectedCashMinor: "-1200",
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: f.broker.id,
            cashMinor: "-1200",
            currency: "BRL",
            asOf: "2026-08-04",
          },
        ],
      },
    })
  })

  it("shows the selected external account and expense categories in a planned application", async () => {
    const f = await setup()
    const result = await preview(f).execute({
      bookId: "book-1",
      draft: {
        ...purchase(),
        type: "APPLICATION",
        funding: { mode: "EXTERNAL_ACCOUNT", accountId: f.bank.id },
        feesMinor: "10",
        taxesMinor: "5",
        feeCategoryId: f.fee.id,
        taxCategoryId: f.tax.id,
      },
    })
    expect(result).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "200",
        netCashFlowMinor: "-215",
        categories: { feeCategoryId: f.fee.id, taxCategoryId: f.tax.id },
        postings: expect.arrayContaining([
          { accountId: f.bank.id, amountMinor: "-215" },
          { accountId: f.broker.id, amountMinor: "200" },
          { accountId: f.fee.id, amountMinor: "10" },
          { accountId: f.tax.id, amountMinor: "5" },
        ]),
      },
    })
  })

  it("shows sale gain, net flow and every resulting account category", async () => {
    const f = await setup()
    const result = await preview(f).execute({
      bookId: "book-1",
      draft: sale(f),
    })
    expect(result).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "-400",
        netCashFlowMinor: "500",
        categories: { gainCategoryId: f.gain.id },
        projectedCashMinor: "-500",
        postings: expect.arrayContaining([
          { accountId: f.broker.id, amountMinor: "100" },
          { accountId: f.gain.id, amountMinor: "-100" },
        ]),
      },
    })
  })

  it("shows the income category and retained charges without changing allocation", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: {
          bookId: "book-1",
          requestId: "income-1",
          positionId: "position-1",
          expectedPositionVersion: 0,
          type: "INCOME",
          occurredOn: "2026-08-04",
          description: "Income",
          currency: "BRL",
          grossAmountMinor: "100",
          feesMinor: "2",
          taxesMinor: "10",
          incomeCategoryId: f.income.id,
          feeCategoryId: f.fee.id,
          taxCategoryId: f.tax.id,
          cashMode: "INTERNAL_CASH",
        },
      })
    ).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "0",
        netCashFlowMinor: "88",
        categories: {
          incomeCategoryId: f.income.id,
          feeCategoryId: f.fee.id,
          taxCategoryId: f.tax.id,
        },
      },
    })
  })

  it("shows a loss category for amortization without changing quantity", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: {
          bookId: "book-1",
          requestId: "amortization-1",
          positionId: "position-1",
          expectedPositionVersion: 0,
          type: "AMORTIZATION",
          occurredOn: "2026-08-04",
          description: "Amortization",
          currency: "BRL",
          bookCostReductionMinor: "200",
          grossProceedsMinor: "100",
          lossCategoryId: f.loss.id,
          cashMode: "INTERNAL_CASH",
        },
      })
    ).toMatchObject({
      ok: true,
      value: {
        bookCostDeltaMinor: "-200",
        netCashFlowMinor: "100",
        categories: { lossCategoryId: f.loss.id },
      },
    })
  })

  it("maps a fee to its expense category and projected cash", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: {
          bookId: "book-1",
          requestId: "fee-1",
          positionId: "position-1",
          expectedPositionVersion: 0,
          type: "FEE",
          occurredOn: "2026-08-04",
          description: "Fee",
          currency: "BRL",
          amountMinor: "10",
          expenseCategoryId: f.fee.id,
          cashMode: "INTERNAL_CASH",
        },
      })
    ).toMatchObject({
      ok: true,
      value: {
        netCashFlowMinor: "-10",
        categories: { feeCategoryId: f.fee.id },
        projectedCashMinor: "-1010",
      },
    })
  })

  it("maps tax to its expense category", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: {
          bookId: "book-1",
          requestId: "tax-1",
          positionId: "position-1",
          expectedPositionVersion: 0,
          type: "TAX",
          occurredOn: "2026-08-04",
          description: "Tax",
          currency: "BRL",
          amountMinor: "10",
          expenseCategoryId: f.tax.id,
          cashMode: "INTERNAL_CASH",
        },
      })
    ).toMatchObject({
      ok: true,
      value: { categories: { taxCategoryId: f.tax.id } },
    })
  })

  it("does not persist an ID, receipt, sequence, fact or other state", async () => {
    const f = await setup()
    const before = f.h.store.snapshot()
    await preview(f).execute({ bookId: "book-1", draft: purchase() })
    expect(f.h.store.snapshot()).toEqual(before)
    expect(f.h.publisher.events).toEqual([])
  })

  it("does not reserve a financial ID before the real confirmation", async () => {
    const f = await setup()
    await preview(f).execute({ bookId: "book-1", draft: purchase() })
    expect(
      await new RecordInvestmentPurchase(
        f.h.transactionManager,
        f.h.dispatcher,
        f.h.ids,
        f.h.clock
      ).execute(purchase())
    ).toMatchObject({ ok: true, value: { operationId: "operation-2" } })
  })

  it("rejects a stale version without changing state", async () => {
    const f = await setup()
    const before = f.h.store.snapshot()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: { ...purchase(), expectedPositionVersion: 1 },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.snapshot()).toEqual(before)
  })

  it("rejects a draft from another book without revealing or mutating its position", async () => {
    const f = await setup()
    const before = f.h.store.snapshot()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: { ...purchase(), bookId: "book-2" },
      })
    ).toMatchObject({ ok: false, error: { code: "BOOK_MISMATCH" } })
    expect(f.h.store.snapshot()).toEqual(before)
  })

  it("rejects a sale whose explicit cost or units exceed the current position", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: { ...sale(f), bookCostReductionMinor: "1001" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: { ...sale(f), quantityDelta: "11" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("rejects an invalid category before presenting an accounting effect", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({
        bookId: "book-1",
        draft: { ...sale(f), gainCategoryId: f.fee.id },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("requires confirmation to revalidate a previewed version", async () => {
    const f = await setup()
    expect(
      await preview(f).execute({ bookId: "book-1", draft: purchase() })
    ).toMatchObject({
      ok: true,
      value: { positionVersion: 0 },
    })
    await new RecordInvestmentPurchase(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute(purchase())
    expect(
      await new RecordInvestmentPurchase(
        f.h.transactionManager,
        f.h.dispatcher,
        f.h.ids,
        f.h.clock
      ).execute({ ...purchase(), requestId: "purchase-2" })
    ).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
  })
})
