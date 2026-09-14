import { describe, expect, it } from "vitest"
import type { InvestmentValuationSnapshot } from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentValuationStore } from "./in-memory-investment-valuation-store.js"

const valuation = (id = "valuation-1", overrides: object = {}) =>
  ({
    id: id as never,
    bookId: "book-1" as never,
    positionId: "position-1" as never,
    allocationRevision: 1,
    valuedAt: "2026-01-01T12:00:00.000Z",
    valuedOn: "2026-01-01",
    recordedAt: "2026-01-01T12:00:00.000Z",
    recordSequence: "1",
    source: "MANUAL",
    currency: "BRL",
    grossValueMinor: "100",
    ...overrides,
  }) as InvestmentValuationSnapshot

describe("InMemoryInvestmentValuationStore", () => {
  it("appends a manual observation", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentValuationStore(store)
    await values.append(valuation())
    expect(store.listInvestmentValuations()).toHaveLength(1)
  })
  it("preserves allocation revision", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentValuationStore(store)
    await values.append(valuation("revision-2", { allocationRevision: 2 }))
    expect(
      store.getInvestmentValuation("revision-2" as never)?.allocationRevision
    ).toBe(2)
  })
  it("keeps observations at the same instant distinct by id", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentValuationStore(store)
    await values.append(valuation("first"))
    await values.append(valuation("second", { recordSequence: "2" }))
    expect(store.listInvestmentValuations().map((item) => item.id)).toEqual([
      "first",
      "second",
    ])
  })
  it("preserves values from different positions", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentValuationStore(store)
    await values.append(valuation("one"))
    await values.append(valuation("two", { positionId: "position-2" as never }))
    expect(store.listInvestmentValuations()).toHaveLength(2)
  })
  it("does not retain caller mutation", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentValuationStore(store)
    const value = valuation()
    await values.append(value)
    ;(value as { grossValueMinor: string }).grossValueMinor = "999"
    expect(store.getInvestmentValuation(value.id)?.grossValueMinor).toBe("100")
  })
  it("returns isolated stored observations", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentValuationStore(store)
    await values.append(valuation())
    const read = store.getInvestmentValuation("valuation-1" as never)!
    ;(read as { grossValueMinor: string }).grossValueMinor = "999"
    expect(
      store.getInvestmentValuation("valuation-1" as never)?.grossValueMinor
    ).toBe("100")
  })
})
