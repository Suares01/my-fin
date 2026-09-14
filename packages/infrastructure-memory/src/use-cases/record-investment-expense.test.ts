import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentExpense,
  RecordInvestmentSale,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await account(h, "Broker")
  const fee = await expense(h, "Fee")
  const tax = await expense(h, "Tax")
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
  return { h, broker, fee, tax }
}
async function account(h: ReturnType<typeof createHarness>, name: string) {
  const result = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name, type: "INVESTMENT_ACCOUNT" })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
async function expense(h: ReturnType<typeof createHarness>, name: string) {
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
function useCase(f: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentExpense(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  )
}
function command(f: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1",
    requestId: "expense-1",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "FEE" as const,
    occurredOn: "2026-08-04",
    description: "Fee",
    currency: "BRL",
    amountMinor: "10",
    expenseCategoryId: f.fee.id,
    cashMode: "INTERNAL_CASH" as const,
  }
}
function close(f: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentSale(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
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

describe("RecordInvestmentExpense", () => {
  it("records one internal fee operation and journal with its exact expense", async () => {
    const f = await setup()
    expect(await useCase(f).execute(command(f))).toEqual({
      ok: true,
      value: {
        requestId: "expense-1",
        positionId: "position-1",
        positionVersion: 1,
        allocationRevision: 1,
        operationId: "operation-2",
        journalEntryIds: ["entry-1"],
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: f.broker.id,
            cashMinor: "-1010",
            currency: "BRL",
            asOf: "2026-08-04",
          },
        ],
      },
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.broker.id, amountMinor: -10n }),
        expect.objectContaining({ accountId: f.fee.id, amountMinor: 10n }),
      ])
    )
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({
      type: "FEE",
      feesMinor: "10",
      taxesMinor: "0",
      bookCostDeltaMinor: "0",
      netCashFlowMinor: "-10",
    })
  })
  it("records tax with the tax category and no fee operation", async () => {
    const f = await setup()
    await useCase(f).execute({
      ...command(f),
      type: "TAX",
      expenseCategoryId: f.tax.id,
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.tax.id, amountMinor: 10n }),
      ])
    )
    expect(
      f.h.store.listInvestmentOperations().map((operation) => operation.type)
    ).toEqual(["OPENING_ALLOCATION", "TAX"])
  })
  it("accepts a fee on a closed active position without reopening or revising it", async () => {
    const f = await setup()
    expect(await close(f)).toMatchObject({ ok: true })
    expect(
      await useCase(f).execute({ ...command(f), expectedPositionVersion: 1 })
    ).toMatchObject({
      ok: true,
      value: { positionVersion: 2, allocationRevision: 2 },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
      allocationRevision: 2,
    })
  })
  it("requires an active expense category", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...command(f), expenseCategoryId: "missing" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })
  it("rejects zero and invalid route amounts without a journal", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...command(f), amountMinor: "0" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(
      await useCase(f).execute({
        ...command(f),
        requestId: "expense-2",
        cashMode: "EXTERNAL_ACCOUNT",
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listJournalEntries()).toEqual([])
  })
  it("rejects stale version without changing allocation", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...command(f), expectedPositionVersion: 1 })
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
  it("replays the same fee without another operation or journal", async () => {
    const f = await setup()
    await useCase(f).execute(command(f))
    expect(await useCase(f).execute(command(f))).toMatchObject({
      ok: true,
      value: { operationId: "operation-2", journalEntryIds: ["entry-1"] },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
  })
  it("rejects changed content under the same request id", async () => {
    const f = await setup()
    await useCase(f).execute(command(f))
    expect(
      await useCase(f).execute({ ...command(f), amountMinor: "11" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })
  it("rejects a position from another book without a receipt", async () => {
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
      await useCase(f).execute({ ...command(f), bookId: other.value.id })
    ).toMatchObject({ ok: false, error: { code: "BOOK_MISMATCH" } })
    expect(
      f.h.store.getInvestmentRequest(other.value.id as never, "expense-1")
    ).toBeUndefined()
  })
  it("records a new operation on a later distinct request", async () => {
    const f = await setup()
    await useCase(f).execute(command(f))
    expect(
      await useCase(f).execute({
        ...command(f),
        requestId: "expense-2",
        expectedPositionVersion: 1,
      })
    ).toMatchObject({
      ok: true,
      value: { operationId: "operation-3", allocationRevision: 1 },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(3)
  })
})
