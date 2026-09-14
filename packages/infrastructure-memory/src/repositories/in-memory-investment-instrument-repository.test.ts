import { describe, expect, it } from "vitest"
import { InvestmentInstrument } from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentInstrumentRepository } from "./in-memory-investment-instrument-repository.js"

function instrument(overrides: Record<string, unknown> = {}) {
  return InvestmentInstrument.create({
    id: "instrument-1" as never,
    bookId: "book-1" as never,
    name: "CDB ABC",
    type: "CDB",
    currency: "BRL",
    baseCurrency: "BRL",
    identifiers: [{ scheme: "TICKER", value: "abc", market: "b3" }],
    ...overrides,
  } as never)
}
describe("InMemoryInvestmentInstrumentRepository", () => {
  it("finds a stored instrument in its book", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    const value = instrument()
    await repo.add(value)
    expect(await repo.findById("book-1", value.id)).toMatchObject({
      kind: "FOUND",
      value: { name: "CDB ABC" },
    })
  })
  it("does not expose instruments from another book", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    const value = instrument()
    await repo.add(value)
    expect(await repo.findById("book-2", value.id)).toEqual({
      kind: "BOOK_MISMATCH",
    })
  })
  it("reports an absent instrument", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    expect(await repo.findById("book-1", "missing" as never)).toEqual({
      kind: "NOT_FOUND",
    })
  })
  it("finds normalized identifiers", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    await repo.add(instrument())
    expect(
      await repo.existsWithIdentifier("book-1", {
        scheme: "TICKER",
        value: " ABC ",
        market: " b3 ",
      })
    ).toBe(true)
  })
  it("keeps identifier uniqueness book-scoped", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    await repo.add(instrument())
    expect(
      await repo.existsWithIdentifier("book-2", {
        scheme: "TICKER",
        value: "ABC",
        market: "B3",
      })
    ).toBe(false)
  })
  it("excludes the selected instrument from duplicate lookup", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    const value = instrument()
    await repo.add(value)
    expect(
      await repo.existsWithIdentifier(
        "book-1",
        { scheme: "TICKER", value: "ABC", market: "B3" },
        value.id
      )
    ).toBe(false)
  })
  it("rejects a nonzero aggregate on add", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    const value = instrument()
    value.archive(false)
    await expect(repo.add(value)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })
  it("rejects stale saves", async () => {
    const repo = new InMemoryInvestmentInstrumentRepository(new InMemoryStore())
    const value = instrument()
    await repo.add(value)
    value.archive(false)
    await expect(repo.save(value, 1)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })
})
