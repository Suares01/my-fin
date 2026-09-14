import {
  CreateFinancialBook,
  CreateInvestmentInstrument,
  UpdateInvestmentInstrument,
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

function update(harness: ReturnType<typeof createHarness>) {
  return new UpdateInvestmentInstrument(
    harness.transactionManager,
    harness.dispatcher
  )
}

const createCommand = {
  bookId: "book-1",
  name: "CDB Banco ABC",
  type: "CDB",
  currency: "BRL",
  identifiers: [{ scheme: "TICKER", value: "CDBA", market: "B3" }],
} as const

const updateCommand = {
  bookId: "book-1",
  instrumentId: "instrument-1",
  expectedVersion: 0,
  name: "CDB Banco Novo",
  type: "CDB",
  currency: "BRL",
  issuerName: "Banco Novo",
  identifiers: [{ scheme: "TICKER", value: "CDBN", market: "B3" }],
} as const

function historicalPosition() {
  return {
    id: "position-1" as never,
    bookId: "book-1" as never,
    investmentAccountId: "account-1" as never,
    instrumentId: "instrument-1" as never,
    normalizedLabel: "reserve",
    quantityMode: "AMOUNT" as const,
    bookCostMinor: "1000",
    currency: "BRL",
    openedOn: "2026-08-04",
    status: "OPEN" as const,
    allocationRevision: 1,
    allocationEffectiveOn: "2026-08-04",
    version: 0,
  }
}

describe("UpdateInvestmentInstrument", () => {
  it("updates metadata atomically and returns one new version", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    harness.publisher.clear()

    const result = await update(harness).execute(updateCommand)

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "instrument-1",
        name: "CDB Banco Novo",
        type: "CDB",
        currency: "BRL",
        issuerName: "Banco Novo",
        identifiers: [{ scheme: "TICKER", value: "CDBN", market: "B3" }],
        version: 1,
      },
    })
    expect(harness.publisher.events).toEqual([
      expect.objectContaining({
        type: "InvestmentInstrumentUpdated",
        aggregateId: "instrument-1",
        aggregateVersion: 1,
      }),
    ])
  })

  it("keeps version and emits no fact for an exact metadata no-op", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    harness.publisher.clear()

    const result = await update(harness).execute({
      ...updateCommand,
      name: "CDB Banco ABC",
      issuerName: undefined,
      identifiers: [{ scheme: "TICKER", value: "CDBA", market: "B3" }],
    })

    expect(result).toMatchObject({ ok: true, value: { version: 0 } })
    expect(harness.publisher.events).toEqual([])
  })

  it("changes type before any historical position and derives its new class", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)

    const result = await update(harness).execute({
      ...updateCommand,
      type: "STOCK",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { type: "STOCK", instrumentClass: "EQUITY", version: 1 },
    })
  })

  it("rejects type changes after a historical position and preserves economic data", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    harness.store.putInvestmentPosition(historicalPosition())
    const before = harness.store.snapshot()

    const result = await update(harness).execute({
      ...updateCommand,
      type: "STOCK",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("allows metadata updates after history without changing the position", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    harness.store.putInvestmentPosition(historicalPosition())
    const beforePosition = harness.store.getInvestmentPosition(
      "position-1" as never
    )

    const result = await update(harness).execute(updateCommand)

    expect(result).toMatchObject({ ok: true, value: { version: 1 } })
    expect(harness.store.getInvestmentPosition("position-1" as never)).toEqual(
      beforePosition
    )
  })

  it("rejects currency distinct from the book base currency", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    const before = harness.store.snapshot()

    const result = await update(harness).execute({
      ...updateCommand,
      currency: "USD",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_CURRENCY_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects an optimistic concurrency conflict without overwriting metadata", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    const before = harness.store.snapshot()

    const result = await update(harness).execute({
      ...updateCommand,
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a missing instrument", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await update(harness).execute(updateCommand)

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a cross-book instrument reference", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    await new CreateFinancialBook(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({
      name: "Other",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
    const before = harness.store.snapshot()

    const result = await update(harness).execute({
      ...updateCommand,
      bookId: "book-2",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a duplicate normalized identifier while retaining original metadata", async () => {
    const harness = createHarness()
    await createBook(harness)
    await create(harness).execute(createCommand)
    await create(harness).execute({
      ...createCommand,
      name: "Other CDB",
      identifiers: [{ scheme: "ISIN", value: "BR0000000002" }],
    })
    const before = harness.store.snapshot()

    const result = await update(harness).execute({
      ...updateCommand,
      identifiers: [{ scheme: "ISIN", value: " br0000000002 " }],
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })
})
