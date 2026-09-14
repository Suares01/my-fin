import {
  CreateFinancialBook,
  CreateInvestmentInstrument,
  SetInvestmentInstrumentStatus,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

function create(harness: ReturnType<typeof createHarness>) {
  return new CreateInvestmentInstrument(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  )
}
function setStatus(harness: ReturnType<typeof createHarness>) {
  return new SetInvestmentInstrumentStatus(
    harness.transactionManager,
    harness.dispatcher
  )
}
const createCommand = {
  bookId: "book-1",
  name: "CDB",
  type: "CDB",
  currency: "BRL",
} as const
const archive = {
  bookId: "book-1",
  instrumentId: "instrument-1",
  expectedVersion: 0,
  status: "ARCHIVED",
} as const
function position(status: "OPEN" | "CLOSED") {
  return {
    id: "position-1" as never,
    bookId: "book-1" as never,
    investmentAccountId: "account-1" as never,
    instrumentId: "instrument-1" as never,
    normalizedLabel: "",
    quantityMode: "AMOUNT" as const,
    bookCostMinor: status === "OPEN" ? "100" : "0",
    currency: "BRL",
    openedOn: "2026-08-04",
    ...(status === "CLOSED" ? { closedOn: "2026-08-05" } : {}),
    status,
    allocationRevision: 1,
    allocationEffectiveOn: "2026-08-04",
    version: 0,
  }
}
describe("SetInvestmentInstrumentStatus", () => {
  it("archives an unused instrument with a versioned fact", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    h.publisher.clear()
    const result = await setStatus(h).execute(archive)
    expect(result).toMatchObject({
      ok: true,
      value: { id: "instrument-1", status: "ARCHIVED", version: 1 },
    })
    expect(h.publisher.events).toEqual([
      expect.objectContaining({
        type: "InvestmentInstrumentArchived",
        aggregateId: "instrument-1",
        aggregateVersion: 1,
        bookId: "book-1",
      }),
    ])
  })
  it("reactivates an archived instrument preserving its identity", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    await setStatus(h).execute(archive)
    h.publisher.clear()
    const result = await setStatus(h).execute({
      ...archive,
      expectedVersion: 1,
      status: "ACTIVE",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { id: "instrument-1", status: "ACTIVE", version: 2 },
    })
    expect(h.publisher.events).toEqual([
      expect.objectContaining({
        type: "InvestmentInstrumentReactivated",
        aggregateVersion: 2,
      }),
    ])
  })
  it("rejects archive with an open position without changing state", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    h.store.putInvestmentPosition(position("OPEN"))
    const before = h.store.snapshot()
    const result = await setStatus(h).execute(archive)
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_INSTRUMENT_IN_USE" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
  it("allows archive after a closed position", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    h.store.putInvestmentPosition(position("CLOSED"))
    expect(await setStatus(h).execute(archive)).toMatchObject({
      ok: true,
      value: { status: "ARCHIVED" },
    })
  })
  it("keeps an archived instrument unchanged when archive is repeated", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    await setStatus(h).execute(archive)
    h.publisher.clear()
    const result = await setStatus(h).execute({
      ...archive,
      expectedVersion: 1,
    })
    expect(result).toMatchObject({
      ok: true,
      value: { status: "ARCHIVED", version: 1 },
    })
    expect(h.publisher.events).toEqual([])
  })
  it("rejects stale status changes", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    const before = h.store.snapshot()
    const result = await setStatus(h).execute({
      ...archive,
      expectedVersion: 1,
    })
    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
  it("rejects a cross-book instrument reference", async () => {
    const h = createHarness()
    await createBook(h)
    await create(h).execute(createCommand)
    await new CreateFinancialBook(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({
      name: "Other",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
    const before = h.store.snapshot()
    const result = await setStatus(h).execute({ ...archive, bookId: "book-2" })
    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
  it("rejects an unknown instrument without exposing a delete path", async () => {
    const h = createHarness()
    await createBook(h)
    const before = h.store.snapshot()
    const result = await setStatus(h).execute(archive)
    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
})
