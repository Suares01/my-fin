import { CreateInvestmentInstrument } from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new CreateInvestmentInstrument(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  )
}

const command = {
  bookId: "book-1",
  name: "  CDB Banco ABC  ",
  type: "CDB",
  currency: "BRL",
} as const

describe("CreateInvestmentInstrument", () => {
  it("creates an active instrument without issuer or identifiers", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute(command)

    expect(result).toEqual({
      ok: true,
      value: {
        id: "instrument-1",
        bookId: "book-1",
        name: "CDB Banco ABC",
        type: "CDB",
        instrumentClass: "FIXED_INCOME",
        currency: "BRL",
        identifiers: [],
        status: "ACTIVE",
        version: 0,
      },
    })
  })

  it("persists optional issuer and normalized ticker identifier", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      ...command,
      issuerName: "  Banco ABC  ",
      identifiers: [{ scheme: "TICKER", value: " cdbx ", market: " b3 " }],
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        issuerName: "Banco ABC",
        identifiers: [{ scheme: "TICKER", value: "CDBX", market: "B3" }],
      },
    })
    expect(
      harness.store.getInvestmentInstrument("instrument-1" as never)
    ).toMatchObject({
      issuerName: "Banco ABC",
      identifiers: [{ scheme: "TICKER", value: "CDBX", market: "B3" }],
    })
  })

  it("normalizes ISIN without market and preserves registration content", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      ...command,
      identifiers: [
        { scheme: "ISIN", value: " brabcd123456 " },
        { scheme: "REGISTRATION_NUMBER", value: " 12 34-AB " },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        identifiers: [
          { scheme: "ISIN", value: "BRABCD123456" },
          { scheme: "REGISTRATION_NUMBER", value: "12 34-AB" },
        ],
      },
    })
  })

  it("publishes the committed instrument fact with book identity", async () => {
    const harness = createHarness()
    await createBook(harness)

    await useCase(harness).execute(command)

    expect(harness.publisher.events).toEqual([
      expect.objectContaining({
        type: "InvestmentInstrumentCreated",
        aggregateId: "instrument-1",
        aggregateVersion: 0,
        bookId: "book-1",
        payload: expect.objectContaining({ status: "ACTIVE", version: 0 }),
      }),
    ])
  })

  it("rejects a missing book without persisting an instrument", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      bookId: "other-book",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects an invalid instrument type without persisting an instrument", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      type: "FUTURE",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_INPUT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects an invalid identifier scheme without persisting an instrument", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      identifiers: [{ scheme: "CUSIP", value: "037833100" }],
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_INPUT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a currency that differs from the book base currency", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      currency: "USD",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_CURRENCY_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a malformed identifier without persisting the instrument", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      identifiers: [{ scheme: "TICKER", value: "CDBX" }],
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_INPUT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects duplicate identifier in the same book without orphaning a new aggregate", async () => {
    const harness = createHarness()
    await createBook(harness)
    await useCase(harness).execute({
      ...command,
      identifiers: [{ scheme: "ISIN", value: "BR0000000001" }],
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      name: "Other instrument",
      identifiers: [{ scheme: "ISIN", value: " br0000000001 " }],
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects duplicate identifiers in one command without persisting the aggregate", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      ...command,
      identifiers: [
        { scheme: "TICKER", value: "CDBX", market: "B3" },
        { scheme: "TICKER", value: " cdbx ", market: " b3 " },
      ],
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })
})
