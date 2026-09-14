import {
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentPurchase,
  RecordInvestmentValuation,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const account = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "Broker", type: "INVESTMENT_ACCOUNT" })
  if (!account.ok) throw new Error("fixture failed")
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
    investmentAccountId: account.value.id,
    instrumentId: instrument.value.id,
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    occurredOn: "2026-08-04",
  })
  if (!opening.ok) throw new Error("fixture failed")
  return h
}

async function record(
  h: Awaited<ReturnType<typeof setup>>,
  patch: object = {}
) {
  return new RecordInvestmentValuation(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  ).execute({
    bookId: "book-1",
    requestId: "valuation",
    positionId: "position-1",
    expectedAllocationRevision: 1,
    valuedAt: "2026-08-04T11:00:00.000Z",
    quantity: "10",
    unitPrice: "120",
    grossValueMinor: "1200",
    ...patch,
  })
}

async function purchase(h: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentPurchase(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  ).execute({
    bookId: "book-1",
    requestId: "purchase",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "PURCHASE",
    occurredOn: "2026-08-04",
    description: "Purchase",
    currency: "BRL",
    quantityDelta: "1",
    capitalMinor: "100",
    funding: { mode: "INTERNAL_CASH" },
  })
}

describe("RecordInvestmentValuation", () => {
  it("appends a manual observation without changing position or ledger state", async () => {
    const h = await setup()
    expect(await record(h)).toMatchObject({
      ok: true,
      value: {
        valuationId: "valuation-1",
        positionId: "position-1",
        positionVersion: 0,
        allocationRevision: 1,
        journalEntryIds: [],
        warnings: [],
      },
    })
    expect(h.store.listInvestmentValuations()).toEqual([
      expect.objectContaining({
        id: "valuation-1",
        allocationRevision: 1,
        valuedAt: "2026-08-04T11:00:00.000Z",
        valuedOn: "2026-08-04",
        recordedAt: "2026-08-04T12:00:00.000Z",
        recordSequence: "2",
        source: "MANUAL",
        quantity: "10",
        unitPrice: "120",
        currency: "BRL",
        grossValueMinor: "1200",
      }),
    ])
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
      version: 0,
      allocationRevision: 1,
    })
    expect(h.store.listJournalEntries()).toEqual([])
  })

  it("keeps omitted net and withdrawable values unknown", async () => {
    const h = await setup()
    await record(h)
    expect(h.store.listInvestmentValuations()[0]).toMatchObject({
      grossValueMinor: "1200",
      netValueMinor: undefined,
      withdrawableValueMinor: undefined,
    })
  })

  it("preserves an earlier observation when a correction appends another one", async () => {
    const h = await setup()
    await record(h)
    expect(
      await record(h, {
        requestId: "valuation-correction",
        grossValueMinor: "1250",
      })
    ).toMatchObject({ ok: true, value: { valuationId: "valuation-2" } })
    expect(h.store.listInvestmentValuations()).toMatchObject([
      { id: "valuation-1", grossValueMinor: "1200" },
      { id: "valuation-2", grossValueMinor: "1250" },
    ])
  })

  it("rejects an allocation revision changed by a completed operation", async () => {
    const h = await setup()
    expect(await purchase(h)).toMatchObject({ ok: true })
    expect(await record(h)).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_ALLOCATION_CHANGED" },
    })
    expect(h.store.listInvestmentValuations()).toEqual([])
  })

  it("allows a queued valuation before an operation and retains it as historical revision one", async () => {
    const h = await setup()
    const valuation = record(h)
    const operation = purchase(h)
    expect(await valuation).toMatchObject({
      ok: true,
      value: { allocationRevision: 1 },
    })
    expect(await operation).toMatchObject({
      ok: true,
      value: { allocationRevision: 2 },
    })
    expect(h.store.listInvestmentValuations()[0]).toMatchObject({
      allocationRevision: 1,
    })
  })

  it("rejects an invalid UTC instant without persisting an observation", async () => {
    const h = await setup()
    expect(await record(h, { valuedAt: "2026-08-04T11:00:00Z" })).toMatchObject(
      {
        ok: false,
        error: { code: "INVALID_INVESTMENT_DATE" },
      }
    )
    expect(h.store.listInvestmentValuations()).toEqual([])
  })

  it("rejects a future UTC instant without persisting an observation", async () => {
    const h = await setup()
    expect(
      await record(h, { valuedAt: "2026-08-04T12:00:00.001Z" })
    ).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_DATE" } })
    expect(h.store.listInvestmentValuations()).toEqual([])
  })

  it("rejects a noncanonical calendar instant without persisting an observation", async () => {
    const h = await setup()
    expect(
      await record(h, { valuedAt: "2026-02-30T11:00:00.000Z" })
    ).toMatchObject({ ok: false, error: { code: "INVALID_INVESTMENT_DATE" } })
    expect(h.store.listInvestmentValuations()).toEqual([])
  })

  it("rejects a quantity different from the declared position revision", async () => {
    const h = await setup()
    expect(await record(h, { quantity: "9" })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_VALUATION" },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
    })
  })

  it("rejects negative gross, net, withdrawable and unit price values", async () => {
    for (const patch of [
      { grossValueMinor: "-1" },
      { netValueMinor: "-1" },
      { withdrawableValueMinor: "-1" },
      { unitPrice: "-1" },
    ]) {
      const h = await setup()
      expect(await record(h, patch)).toMatchObject({
        ok: false,
        error: { code: "INVALID_INVESTMENT_VALUATION" },
      })
      expect(h.store.listInvestmentValuations()).toEqual([])
    }
  })

  it("uses the persisted position currency for the observation", async () => {
    const h = await setup()
    await record(h)
    expect(h.store.listInvestmentValuations()[0]?.currency).toBe("BRL")
  })

  it("rejects a missing position before adding a receipt or observation", async () => {
    const h = await setup()
    expect(await record(h, { positionId: "missing" })).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(h.store.listInvestmentValuations()).toEqual([])
    expect(
      h.store.getInvestmentRequest("book-1" as never, "valuation")
    ).toBeUndefined()
  })

  it("rejects a position from another book without adding an observation", async () => {
    const h = await setup()
    const other = await new CreateFinancialBook(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({
      name: "Other book",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
    if (!other.ok) throw new Error("fixture failed")
    expect(await record(h, { bookId: other.value.id })).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(h.store.listInvestmentValuations()).toEqual([])
  })

  it("replays the same request without another observation or sequence", async () => {
    const h = await setup()
    const first = await record(h)
    const second = await record(h)
    expect(second).toEqual(first)
    expect(h.store.listInvestmentValuations()).toHaveLength(1)
    expect(h.store.snapshot().investmentSequences).toEqual([
      { bookId: "book-1", lastSequence: "2" },
    ])
  })

  it("rejects changed content for a confirmed request without another observation", async () => {
    const h = await setup()
    await record(h)
    expect(await record(h, { grossValueMinor: "1300" })).toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT" },
    })
    expect(h.store.listInvestmentValuations()).toHaveLength(1)
  })
})
