import { describe, expect, it } from "vitest"
import { InvestmentPosition } from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentPositionRepository } from "./in-memory-investment-position-repository.js"
const position = (id = "position-1", overrides: object = {}) =>
  InvestmentPosition.openWithAllocation({
    id: id as never,
    bookId: "book-1" as never,
    investmentAccountId: "account-1" as never,
    instrumentId: "instrument-1" as never,
    instrumentClass: "FIXED_INCOME",
    quantityMode: "UNITS",
    quantity: "1",
    bookCostMinor: "100",
    currency: "BRL",
    openedOn: "2026-01-01",
    fixedIncomeTerms: { rateKind: "PREFIXED", annualRate: "10" },
    ...overrides,
  } as never)
describe("InMemoryInvestmentPositionRepository", () => {
  it("finds a same-book position with terms", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore()),
      p = position()
    await r.add(p)
    expect(await r.findById("book-1", p.id)).toMatchObject({
      kind: "FOUND",
      value: { id: p.id },
    })
  })
  it("hides another book", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore()),
      p = position()
    await r.add(p)
    expect(await r.findById("other", p.id)).toEqual({ kind: "BOOK_MISMATCH" })
  })
  it("reports missing", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore())
    expect(await r.findById("book-1", "missing" as never)).toEqual({
      kind: "NOT_FOUND",
    })
  })
  it("keeps same-instrument positions separate", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore())
    await r.add(position())
    await r.add(position("position-2"))
    expect(await r.hasAnyForInstrument("book-1", "instrument-1" as never)).toBe(
      true
    )
  })
  it("finds account history", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore())
    await r.add(position())
    expect(await r.hasAnyForAccount("book-1", "account-1" as never)).toBe(true)
  })
  it("finds open instrument", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore())
    await r.add(position())
    expect(
      await r.hasOpenForInstrument("book-1", "instrument-1" as never)
    ).toBe(true)
  })
  it("rejects nonzero add", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore()),
      p = position()
    p.applyOperation({
      quantityDelta: "1",
      bookCostDeltaMinor: "0",
      occurredOn: "2026-01-02",
    })
    await expect(r.add(p)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })
  it("rejects stale save", async () => {
    const r = new InMemoryInvestmentPositionRepository(new InMemoryStore()),
      p = position()
    await r.add(p)
    p.applyOperation({
      quantityDelta: "1",
      bookCostDeltaMinor: "0",
      occurredOn: "2026-01-02",
    })
    await expect(r.save(p, 1)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })
})
