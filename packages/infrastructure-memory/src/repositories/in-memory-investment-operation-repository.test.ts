import { describe, expect, it } from "vitest"
import { InvestmentOperation } from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentOperationRepository } from "./in-memory-investment-operation-repository.js"

const operation = (id = "operation-1", overrides: object = {}) =>
  InvestmentOperation.record({
    id: id as never,
    bookId: "book-1" as never,
    positionId: "position-1" as never,
    type: "SALE",
    occurredOn: "2026-01-02",
    recordedAt: "2026-01-02T12:00:00.000Z",
    sequence: "2",
    description: "Venda",
    currency: "BRL",
    quantityDelta: "-4",
    bookCostDeltaMinor: "-400",
    grossAmountMinor: "500",
    feesMinor: "10",
    taxesMinor: "20",
    netCashFlowMinor: "470",
    cashMode: "INTERNAL_CASH",
    categories: {},
    positionBefore: { kind: "UNOPENED" },
    ...overrides,
  } as never)

describe("InMemoryInvestmentOperationRepository", () => {
  it("restores persisted deltas and lineage", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    const value = operation()
    value.markReversedBy("reversal-1" as never)
    await repo.add(
      InvestmentOperation.restore({ ...value.toSnapshot(), version: 0 })
    )
    const found = await repo.findById("book-1", value.id)
    expect(found).toMatchObject({ kind: "FOUND", value: { id: value.id } })
  })
  it("keeps lookup book-scoped", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    const value = operation()
    await repo.add(value)
    expect(await repo.findById("other", value.id)).toEqual({
      kind: "BOOK_MISMATCH",
    })
  })
  it("reports a missing operation", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    expect(await repo.findById("book-1", "missing" as never)).toEqual({
      kind: "NOT_FOUND",
    })
  })
  it("chooses the latest effective operation by date", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    await repo.add(
      operation("old", { occurredOn: "2026-01-01", sequence: "9" })
    )
    await repo.add(operation("latest"))
    expect(
      (await repo.findLastEffective("book-1", "position-1" as never))?.id
    ).toBe("latest")
  })
  it("uses exact sequence ordering for same-date operations", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    await repo.add(operation("two", { sequence: "2" }))
    await repo.add(operation("ten", { sequence: "10" }))
    expect(
      (await repo.findLastEffective("book-1", "position-1" as never))?.id
    ).toBe("ten")
  })
  it("does not count reversals as effective", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    const original = operation()
    await repo.add(original)
    await repo.add(
      InvestmentOperation.createReversal({
        id: "reversal" as never,
        original: original.toSnapshot(),
        recordedAt: "2026-01-03T12:00:00.000Z",
        sequence: "3",
      })
    )
    expect(
      (await repo.findLastEffective("book-1", "position-1" as never))?.id
    ).toBe(original.id)
  })
  it("excludes the correction target", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    await repo.add(operation("old", { sequence: "1" }))
    await repo.add(operation("target", { sequence: "2" }))
    expect(
      (
        await repo.findLastEffective(
          "book-1",
          "position-1" as never,
          "target" as never
        )
      )?.id
    ).toBe("old")
  })
  it("rejects stale lineage writes", async () => {
    const repo = new InMemoryInvestmentOperationRepository(new InMemoryStore())
    const value = operation()
    await repo.add(value)
    value.markReplacedBy("replacement" as never)
    await expect(repo.saveLineage(value, 1)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })
})
