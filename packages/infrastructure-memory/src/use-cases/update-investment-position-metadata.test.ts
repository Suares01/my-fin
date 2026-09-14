import {
  CreateFinancialBook,
  UpdateInvestmentPositionMetadata,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"
function useCase(h: ReturnType<typeof createHarness>) {
  return new UpdateInvestmentPositionMetadata(
    h.transactionManager,
    h.dispatcher
  )
}
function position(bookId = "book-1") {
  return {
    id: "position-1" as never,
    bookId: bookId as never,
    investmentAccountId: "account-1" as never,
    instrumentId: "instrument-1" as never,
    label: "Reserve",
    normalizedLabel: "reserve",
    quantityMode: "UNITS" as const,
    quantity: "10",
    bookCostMinor: "1000",
    currency: "BRL",
    openedOn: "2026-08-04",
    status: "OPEN" as const,
    allocationRevision: 2,
    allocationEffectiveOn: "2026-08-04",
    version: 0,
  }
}
const command = {
  bookId: "book-1",
  positionId: "position-1",
  expectedVersion: 0,
  label: " Travel ",
} as const
describe("UpdateInvestmentPositionMetadata", () => {
  it("updates only the label and emits its new version", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
    const before = h.store.getInvestmentPosition("position-1" as never)!
    h.publisher.clear()
    const result = await useCase(h).execute(command)
    expect(result).toEqual({
      ok: true,
      value: {
        id: "position-1",
        bookId: "book-1",
        label: "Travel",
        version: 1,
      },
    })
    expect(h.store.getInvestmentPosition("position-1" as never)).toMatchObject({
      ...before,
      label: "Travel",
      normalizedLabel: "travel",
      version: 1,
    })
    expect(h.publisher.events).toEqual([
      expect.objectContaining({
        type: "InvestmentPositionChanged",
        aggregateId: "position-1",
        aggregateVersion: 1,
      }),
    ])
  })
  it("keeps every economic field unchanged when updating the label", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
    const before = h.store.getInvestmentPosition("position-1" as never)!
    await useCase(h).execute(command)
    const after = h.store.getInvestmentPosition("position-1" as never)!
    expect({
      ...after,
      label: before.label,
      normalizedLabel: before.normalizedLabel,
      version: before.version,
    }).toEqual(before)
  })
  it("clears a label without changing economic fields", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
    const result = await useCase(h).execute({ ...command, label: undefined })
    expect(result).toEqual({
      ok: true,
      value: { id: "position-1", bookId: "book-1", version: 1 },
    })
    expect(h.store.getInvestmentPosition("position-1" as never)).toMatchObject({
      label: undefined,
      normalizedLabel: "",
      quantity: "10",
      bookCostMinor: "1000",
      allocationRevision: 2,
    })
  })
  it("keeps version and fact list empty for a label no-op", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
    h.publisher.clear()
    const result = await useCase(h).execute({ ...command, label: "Reserve" })
    expect(result).toMatchObject({
      ok: true,
      value: { version: 0, label: "Reserve" },
    })
    expect(h.publisher.events).toEqual([])
  })
  it("rejects a stale version without changing the position", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
    const before = h.store.snapshot()
    const result = await useCase(h).execute({ ...command, expectedVersion: 1 })
    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
  it("rejects an unknown position", async () => {
    const h = createHarness()
    await createBook(h)
    const before = h.store.snapshot()
    const result = await useCase(h).execute(command)
    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
  it("rejects a cross-book position", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
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
    const result = await useCase(h).execute({ ...command, bookId: "book-2" })
    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
  it("rejects a label beyond the normative text limit without changing history", async () => {
    const h = createHarness()
    await createBook(h)
    h.store.putInvestmentPosition(position())
    const before = h.store.snapshot()
    const result = await useCase(h).execute({
      ...command,
      label: "x".repeat(121),
    })
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_INPUT" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })
})
