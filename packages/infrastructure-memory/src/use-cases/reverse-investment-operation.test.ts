import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentIncome,
  RecordInvestmentSale,
  ReverseInvestmentOperation,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await account(h, "Broker", "INVESTMENT_ACCOUNT")
  const gain = await category(h, "Gain", "INCOME")
  const income = await category(h, "Income", "INCOME")
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
  return { h, broker, gain, income }
}
async function account(
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
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
function reverse(f: Awaited<ReturnType<typeof setup>>, patch = {}) {
  return new ReverseInvestmentOperation(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "reverse-1",
    operationId: "operation-2",
    expectedOperationVersion: 0,
    expectedPositionVersion: 1,
    reason: "Correct sale",
    ...patch,
  })
}
async function sale(f: Awaited<ReturnType<typeof setup>>, patch = {}) {
  return new RecordInvestmentSale(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "sale-1",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "SALE",
    occurredOn: "2026-08-04",
    description: "Sale",
    currency: "BRL",
    quantityDelta: "4",
    bookCostReductionMinor: "400",
    grossProceedsMinor: "500",
    destination: { mode: "INTERNAL_CASH" },
    gainCategoryId: f.gain.id,
    ...patch,
  })
}

describe("ReverseInvestmentOperation", () => {
  it("appends a reversal and restores the original partial-sale economic state", async () => {
    const f = await setup()
    await sale(f)
    expect(await reverse(f)).toMatchObject({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 2,
        allocationRevision: 3,
        operationId: "operation-2",
        reversalOperationId: "operation-3",
        journalEntryIds: ["entry-2"],
      },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
      status: "OPEN",
    })
    expect(f.h.store.listInvestmentOperations()).toMatchObject([
      expect.objectContaining({ id: "operation-1" }),
      expect.objectContaining({
        id: "operation-2",
        reversedBy: "operation-3",
        version: 1,
      }),
      expect.objectContaining({
        id: "operation-3",
        role: "REVERSAL",
        reversalOf: "operation-2",
        quantityDelta: "4",
        bookCostDeltaMinor: "400",
        netCashFlowMinor: "-500",
      }),
    ])
  })

  it("reopens a fully sold position and clears its close date", async () => {
    const f = await setup()
    await sale(f, {
      quantityDelta: "10",
      bookCostReductionMinor: "1000",
      grossProceedsMinor: "1100",
    })
    await reverse(f)
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
      status: "OPEN",
      closedOn: undefined,
    })
  })

  it("blocks reopening a closed position when its investment account is archived", async () => {
    const f = await setup()
    await sale(f, {
      quantityDelta: "10",
      bookCostReductionMinor: "1000",
      grossProceedsMinor: "1100",
    })
    f.h.store.putAccount({
      ...f.h.store.getAccount(f.broker.id as never)!,
      status: "ARCHIVED",
    })
    expect(await reverse(f)).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_ENTITY_NOT_ACTIVE" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      status: "CLOSED",
      quantity: "0",
      bookCostMinor: "0",
    })
  })

  it("dates the journal reversal on the original operation date and records correction time", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(f.h.store.listJournalEntries()[1]).toMatchObject({
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T12:00:00.000Z",
      reversalOf: "entry-1",
    })
  })

  it("inverts each persisted posting without recalculating the sale plan", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    const [original, reversal] = f.h.store.listJournalEntries()
    expect(reversal?.postings).toEqual(
      original?.postings.map((posting) =>
        expect.objectContaining({
          accountId: posting.accountId,
          amountMinor: -posting.amountMinor,
        })
      )
    )
  })

  it("does not invent a journal reversal for an operation without a journal", async () => {
    const f = await setup()
    await sale(f, {
      quantityDelta: "10",
      bookCostReductionMinor: "1000",
      grossProceedsMinor: "1000",
    })
    expect(await reverse(f)).toMatchObject({
      ok: true,
      value: { journalEntryIds: [] },
    })
    expect(f.h.store.listJournalEntries()).toHaveLength(0)
  })

  it("replays an identical cancellation without extra operation, journal, or receipt effects", async () => {
    const f = await setup()
    await sale(f)
    const first = await reverse(f)
    const second = await reverse(f)
    expect(second).toEqual(first)
    expect(f.h.store.listInvestmentOperations()).toHaveLength(3)
    expect(f.h.store.listJournalEntries()).toHaveLength(2)
  })

  it("rejects changed content for an existing cancellation request id", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(await reverse(f, { reason: "Another reason" })).toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT" },
    })
  })

  it("rejects a cancellation target that is already reversed", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(
      await reverse(f, {
        requestId: "reverse-2",
        expectedOperationVersion: 1,
        expectedPositionVersion: 2,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_OPERATION_NOT_CORRECTABLE" },
    })
  })

  it("rejects a target that is not the last effective operation", async () => {
    const f = await setup()
    await sale(f)
    const income = await new RecordInvestmentIncome(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      requestId: "income-1",
      positionId: "position-1",
      expectedPositionVersion: 1,
      type: "INCOME",
      occurredOn: "2026-08-04",
      description: "Income",
      currency: "BRL",
      grossAmountMinor: "10",
      incomeCategoryId: f.income.id,
      cashMode: "INTERNAL_CASH",
    })
    expect(income).toMatchObject({ ok: true })
    expect(
      await reverse(f, { requestId: "reverse-2", expectedPositionVersion: 2 })
    ).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_OPERATION_NOT_CORRECTABLE" },
    })
  })

  it("rejects a stale operation version before changing the position", async () => {
    const f = await setup()
    await sale(f)
    expect(await reverse(f, { expectedOperationVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "6",
      bookCostMinor: "600",
      version: 1,
    })
  })

  it("rejects a stale position version before adding the reversal", async () => {
    const f = await setup()
    await sale(f)
    expect(await reverse(f, { expectedPositionVersion: 0 })).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
  })

  it("rejects a missing operation without persisting a receipt", async () => {
    const f = await setup()
    expect(
      await reverse(f, {
        operationId: "operation-99",
        expectedPositionVersion: 0,
      })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(
      f.h.store.getInvestmentRequest("book-1" as never, "reverse-1")
    ).toBeUndefined()
  })

  it("rejects an operation belonging to another book", async () => {
    const f = await setup()
    await sale(f)
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
    expect(await reverse(f, { bookId: other.value.id })).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
  })

  it("keeps original and reversal postings in the ledger", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(f.h.store.listJournalEntries()).toHaveLength(2)
    expect(f.h.store.listJournalEntries()[0]).toMatchObject({
      reversedBy: "entry-2",
      version: 1,
    })
  })

  it("emits the negative cash warning as an additive successful result", async () => {
    const f = await setup()
    await sale(f)
    expect(await reverse(f)).toMatchObject({
      ok: true,
      value: {
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: f.broker.id,
            cashMinor: "-1000",
            currency: "BRL",
            asOf: "2026-08-04",
          },
        ],
      },
    })
  })

  it("uses a new allocation revision when cancellation restores an earlier economic state", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      allocationRevision: 3,
    })
  })

  it("preserves the original operation audit values while adding inverse authoritative effects", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({
      quantityDelta: "-4",
      bookCostDeltaMinor: "-400",
      netCashFlowMinor: "500",
      grossAmountMinor: "500",
    })
    expect(f.h.store.listInvestmentOperations()[2]).toMatchObject({
      quantityDelta: "4",
      bookCostDeltaMinor: "400",
      netCashFlowMinor: "-500",
      grossAmountMinor: "500",
    })
  })

  it("records reversal lineage facts only after the transactional changes complete", async () => {
    const f = await setup()
    await sale(f)
    const result = await reverse(f)
    expect(result).toMatchObject({ ok: true })
    expect(f.h.publisher.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "InvestmentOperationReversed",
        "InvestmentPositionChanged",
        "JournalEntryPosted",
      ])
    )
  })

  it("retains an initial position as closed historical zero state when its opening operation is cancelled", async () => {
    const f = await setup()
    expect(
      await new ReverseInvestmentOperation(
        f.h.transactionManager,
        f.h.dispatcher,
        f.h.ids,
        f.h.clock
      ).execute({
        bookId: "book-1",
        requestId: "reverse-open",
        operationId: "operation-1",
        expectedOperationVersion: 0,
        expectedPositionVersion: 0,
        reason: "Cancel opening",
      })
    ).toMatchObject({ ok: true })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
    })
  })

  it("creates one reversal operation with the correction clock time", async () => {
    const f = await setup()
    await sale(f)
    await reverse(f)
    expect(f.h.store.listInvestmentOperations()[2]).toMatchObject({
      recordedAt: "2026-08-04T12:00:00.000Z",
      occurredOn: "2026-08-04",
      role: "REVERSAL",
    })
  })
})
