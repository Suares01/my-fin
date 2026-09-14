import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentIncome,
  RecordInvestmentSale,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await financialAccount(h, "Broker", "INVESTMENT_ACCOUNT")
  const income = await incomeCategory(h, "Income")
  const fee = await expenseCategory(h, "Fee")
  const tax = await expenseCategory(h, "Tax")
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!instrument.ok) throw new Error("fixture failed")
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
  if (!opening.ok) throw new Error("fixture failed")
  h.publisher.clear()
  return { h, broker, income, fee, tax }
}

async function financialAccount(
  h: ReturnType<typeof createHarness>,
  name: string,
  type: "INVESTMENT_ACCOUNT"
) {
  const result = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

async function expenseCategory(
  h: ReturnType<typeof createHarness>,
  name: string
) {
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
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

async function incomeCategory(
  h: ReturnType<typeof createHarness>,
  name: string
) {
  const result = await new CreateIncomeCategory(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({
    bookId: "book-1",
    name,
    kind: "INCOME",
    iconKey: "chart",
    colorHex: "10b981",
  })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

function useCase(fixture: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentIncome(
    fixture.h.transactionManager,
    fixture.h.dispatcher,
    fixture.h.ids,
    fixture.h.clock
  )
}

function income(fixture: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1",
    requestId: "income-1",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "INCOME" as const,
    occurredOn: "2026-08-04",
    description: "Income",
    currency: "BRL",
    grossAmountMinor: "100",
    feesMinor: "2",
    taxesMinor: "10",
    incomeCategoryId: fixture.income.id,
    feeCategoryId: fixture.fee.id,
    taxCategoryId: fixture.tax.id,
    cashMode: "INTERNAL_CASH" as const,
  }
}

function saleToClose(fixture: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentSale(
    fixture.h.transactionManager,
    fixture.h.dispatcher,
    fixture.h.ids,
    fixture.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "close",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "SALE",
    occurredOn: "2026-08-04",
    description: "Close",
    currency: "BRL",
    quantityDelta: "10",
    bookCostReductionMinor: "1000",
    grossProceedsMinor: "1000",
    destination: { mode: "INTERNAL_CASH" },
  })
}

describe("RecordInvestmentIncome", () => {
  it("records the normative retained income in one operation and journal", async () => {
    const f = await setup()
    expect(await useCase(f).execute(income(f))).toEqual({
      ok: true,
      value: {
        requestId: "income-1",
        positionId: "position-1",
        positionVersion: 1,
        allocationRevision: 1,
        operationId: "operation-2",
        journalEntryIds: ["entry-1"],
        warnings: [],
      },
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.broker.id, amountMinor: 88n }),
        expect.objectContaining({ accountId: f.income.id, amountMinor: -100n }),
        expect.objectContaining({ accountId: f.fee.id, amountMinor: 2n }),
        expect.objectContaining({ accountId: f.tax.id, amountMinor: 10n }),
      ])
    )
  })

  it("preserves allocation while recording the complete income audit snapshot", async () => {
    const f = await setup()
    await useCase(f).execute(income(f))
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
      status: "OPEN",
      allocationRevision: 1,
      version: 1,
    })
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({
      type: "INCOME",
      bookCostDeltaMinor: "0",
      grossAmountMinor: "100",
      feesMinor: "2",
      taxesMinor: "10",
      netCashFlowMinor: "88",
      cashMode: "INTERNAL_CASH",
      positionBefore: { quantity: "10", bookCostMinor: "1000", status: "OPEN" },
    })
  })

  it("does not create auxiliary fee or tax operations for retained income", async () => {
    const f = await setup()
    await useCase(f).execute(income(f))
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
    expect(
      f.h.store.listInvestmentOperations().map((operation) => operation.type)
    ).toEqual(["OPENING_ALLOCATION", "INCOME"])
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
  })

  it("accepts income on an active closed position without reopening it", async () => {
    const f = await setup()
    expect(await saleToClose(f)).toMatchObject({ ok: true })
    expect(
      await useCase(f).execute({ ...income(f), expectedPositionVersion: 1 })
    ).toMatchObject({
      ok: true,
      value: {
        positionVersion: 2,
        allocationRevision: 2,
        operationId: "operation-3",
      },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
      closedOn: "2026-08-04",
      allocationRevision: 2,
    })
  })

  it("requires an active income category", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...income(f), incomeCategoryId: undefined })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("requires an expense category for each nonzero retention", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...income(f), feeCategoryId: undefined })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
    expect(
      await useCase(f).execute({
        ...income(f),
        requestId: "income-2",
        taxCategoryId: undefined,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("rejects a nonpositive gross amount or a negative retained net amount", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...income(f), grossAmountMinor: "0" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(
      await useCase(f).execute({
        ...income(f),
        requestId: "income-2",
        grossAmountMinor: "11",
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("rejects an external cash route without persisting the income", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...income(f),
        cashMode: "EXTERNAL_ACCOUNT",
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listJournalEntries()).toEqual([])
  })

  it("rejects a stale position version without changing allocation", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...income(f), expectedPositionVersion: 1 })
    ).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      bookCostMinor: "1000",
      allocationRevision: 1,
      version: 0,
    })
  })

  it("replays the same income without a second operation or journal", async () => {
    const f = await setup()
    await useCase(f).execute(income(f))
    expect(await useCase(f).execute(income(f))).toMatchObject({
      ok: true,
      value: { operationId: "operation-2", journalEntryIds: ["entry-1"] },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
  })

  it("rejects changed content under a reused income request id", async () => {
    const f = await setup()
    await useCase(f).execute(income(f))
    expect(
      await useCase(f).execute({ ...income(f), grossAmountMinor: "101" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })

  it("rejects a position from another book without writing a receipt", async () => {
    const f = await setup()
    const other = await new CreateFinancialBook(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids
    ).execute({
      name: "Other",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
    if (!other.ok) throw new Error("fixture failed")
    expect(
      await useCase(f).execute({ ...income(f), bookId: other.value.id })
    ).toMatchObject({ ok: false, error: { code: "BOOK_MISMATCH" } })
    expect(
      f.h.store.getInvestmentRequest(other.value.id as never, "income-1")
    ).toBeUndefined()
  })
})
