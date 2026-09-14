import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentAmortization,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await account(h, "Broker", "INVESTMENT_ACCOUNT")
  const gain = await income(h, "Gain")
  const loss = await expense(h, "Loss")
  const fee = await expense(h, "Fee")
  const tax = await expense(h, "Tax")
  const instrument = await new CreateInvestmentInstrument(h.transactionManager, h.dispatcher, h.ids).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!instrument.ok) throw new Error("fixture failed")
  const opening = await new OpenInvestmentPosition(h.transactionManager, h.dispatcher, h.ids, h.clock).execute({ bookId: "book-1", requestId: "open", investmentAccountId: broker.id, instrumentId: instrument.value.id, quantityMode: "UNITS", quantity: "10", bookCostMinor: "1000", occurredOn: "2026-08-04" })
  if (!opening.ok) throw new Error("fixture failed")
  h.publisher.clear()
  return { h, broker, gain, loss, fee, tax }
}
async function account(h: ReturnType<typeof createHarness>, name: string, type: "INVESTMENT_ACCOUNT") {
  const result = await new CreateFinancialAccount(h.transactionManager, h.dispatcher, h.ids).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
async function expense(h: ReturnType<typeof createHarness>, name: string) {
  const result = await new CreateExpenseCategory(h.transactionManager, h.dispatcher, h.ids).execute({ bookId: "book-1", name, kind: "EXPENSE", iconKey: "receipt", colorHex: "f43f5e" })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
async function income(h: ReturnType<typeof createHarness>, name: string) {
  const result = await new CreateIncomeCategory(h.transactionManager, h.dispatcher, h.ids).execute({ bookId: "book-1", name, kind: "INCOME", iconKey: "chart", colorHex: "10b981" })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
function useCase(f: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentAmortization(f.h.transactionManager, f.h.dispatcher, f.h.ids, f.h.clock)
}
function amortization(f: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1", requestId: "amortization-1", positionId: "position-1", expectedPositionVersion: 0,
    type: "AMORTIZATION" as const, occurredOn: "2026-08-04", description: "Amortization", currency: "BRL",
    bookCostReductionMinor: "200", grossProceedsMinor: "220", gainCategoryId: f.gain.id,
    lossCategoryId: f.loss.id, feeCategoryId: f.fee.id, taxCategoryId: f.tax.id,
    cashMode: "INTERNAL_CASH" as const,
  }
}
describe("RecordInvestmentAmortization", () => {
  it("reduces cost, preserves units and records the normative receipt and gain", async () => {
    const f = await setup()
    expect(await useCase(f).execute(amortization(f))).toEqual({ ok: true, value: { requestId: "amortization-1", positionId: "position-1", positionVersion: 1, allocationRevision: 2, operationId: "operation-2", journalEntryIds: ["entry-1"], warnings: [] } })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({ quantity: "10", bookCostMinor: "800", status: "OPEN", allocationRevision: 2 })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: f.broker.id, amountMinor: 20n }),
      expect.objectContaining({ accountId: f.gain.id, amountMinor: -20n }),
    ]))
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({ bookCostDeltaMinor: "-200", grossAmountMinor: "220", netCashFlowMinor: "220" })
  })

  it("separates retained fees and taxes in the single amortization journal", async () => {
    const f = await setup()
    await useCase(f).execute({ ...amortization(f), feesMinor: "2", taxesMinor: "10" })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: f.broker.id, amountMinor: 8n }),
      expect.objectContaining({ accountId: f.gain.id, amountMinor: -20n }),
      expect.objectContaining({ accountId: f.fee.id, amountMinor: 2n }),
      expect.objectContaining({ accountId: f.tax.id, amountMinor: 10n }),
    ]))
    expect(f.h.store.listInvestmentOperations().map((operation) => operation.type)).toEqual(["OPENING_ALLOCATION", "AMORTIZATION"])
  })

  it("records a loss when receipt is lower than reduced cost", async () => {
    const f = await setup()
    await useCase(f).execute({ ...amortization(f), grossProceedsMinor: "100" })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: f.broker.id, amountMinor: -100n }),
      expect.objectContaining({ accountId: f.loss.id, amountMinor: 100n }),
    ]))
  })

  it("requires the category matching a nonzero result or retention", async () => {
    const f = await setup()
    expect(await useCase(f).execute({ ...amortization(f), gainCategoryId: undefined })).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_CATEGORY" } })
    expect(await useCase(f).execute({ ...amortization(f), requestId: "amortization-2", grossProceedsMinor: "100", lossCategoryId: undefined })).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_CATEGORY" } })
    expect(await useCase(f).execute({ ...amortization(f), requestId: "amortization-3", feesMinor: "1", feeCategoryId: undefined })).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_CATEGORY" } })
  })

  it("rejects a zero, excessive or invalid-net cost reduction without changing state", async () => {
    const f = await setup()
    expect(await useCase(f).execute({ ...amortization(f), bookCostReductionMinor: "0" })).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_OPERATION" } })
    expect(await useCase(f).execute({ ...amortization(f), requestId: "amortization-2", bookCostReductionMinor: "1001" })).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_OPERATION" } })
    expect(await useCase(f).execute({ ...amortization(f), requestId: "amortization-3", grossProceedsMinor: "1", feesMinor: "2" })).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_OPERATION" } })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({ quantity: "10", bookCostMinor: "1000", version: 0 })
  })

  it("rejects an external cash route without persisting a journal", async () => {
    const f = await setup()
    expect(await useCase(f).execute({ ...amortization(f), cashMode: "EXTERNAL_ACCOUNT" } as never)).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_OPERATION" } })
    expect(f.h.store.listJournalEntries()).toEqual([])
  })

  it("rejects stale position version without changing the allocation", async () => {
    const f = await setup()
    expect(await useCase(f).execute({ ...amortization(f), expectedPositionVersion: 1 })).toMatchObject({ ok: false, error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" } })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({ bookCostMinor: "1000", allocationRevision: 1, version: 0 })
  })

  it("replays the same amortization without another operation or journal", async () => {
    const f = await setup()
    await useCase(f).execute(amortization(f))
    expect(await useCase(f).execute(amortization(f))).toMatchObject({ ok: true, value: { operationId: "operation-2", journalEntryIds: ["entry-1"] } })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
  })

  it("rejects changed content under a reused request id", async () => {
    const f = await setup()
    await useCase(f).execute(amortization(f))
    expect(await useCase(f).execute({ ...amortization(f), grossProceedsMinor: "221" })).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })

  it("rejects a position from another book without writing a receipt", async () => {
    const f = await setup()
    const other = await new CreateFinancialBook(f.h.transactionManager, f.h.dispatcher, f.h.ids).execute({ name: "Other", baseCurrency: "BRL", timezone: "America/Sao_Paulo" })
    if (!other.ok) throw new Error("fixture failed")
    expect(await useCase(f).execute({ ...amortization(f), bookId: other.value.id })).toMatchObject({ ok: false, error: { code: "BOOK_MISMATCH" } })
    expect(f.h.store.getInvestmentRequest(other.value.id as never, "amortization-1")).toBeUndefined()
  })
})
