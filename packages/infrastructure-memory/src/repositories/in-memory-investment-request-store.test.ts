import { describe, expect, it } from "vitest"
import type { InvestmentRequestReceipt } from "@workspace/application"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentRequestStore } from "./in-memory-investment-request-store.js"

const receipt = (overrides: object = {}) =>
  ({
    bookId: "book-1",
    requestId: "request-1",
    formatVersion: 1,
    canonicalCommand: "{}",
    result: { requestId: "request-1", journalEntryIds: [], warnings: [] },
    recordedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  }) as InvestmentRequestReceipt

describe("InMemoryInvestmentRequestStore", () => {
  it("returns null for a missing receipt", async () => {
    const values = new InMemoryInvestmentRequestStore(new InMemoryStore())
    await expect(values.find("book-1", "missing")).resolves.toBeNull()
  })
  it("round-trips a canonical command and result", async () => {
    const values = new InMemoryInvestmentRequestStore(new InMemoryStore()),
      value = receipt()
    await values.add(value)
    await expect(values.find(value.bookId, value.requestId)).resolves.toEqual(
      value
    )
  })
  it("scopes the receipt by book and request id", async () => {
    const values = new InMemoryInvestmentRequestStore(new InMemoryStore())
    await values.add(receipt())
    await expect(values.find("other", "request-1")).resolves.toBeNull()
  })
  it("rejects duplicate book/request without overwrite", async () => {
    const values = new InMemoryInvestmentRequestStore(new InMemoryStore())
    const first = receipt()
    await values.add(first)
    await expect(
      values.add(receipt({ canonicalCommand: "different" }))
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
    await expect(values.find("book-1", "request-1")).resolves.toEqual(first)
  })
  it("stores independent request ids", async () => {
    const values = new InMemoryInvestmentRequestStore(new InMemoryStore())
    await values.add(receipt())
    await values.add(
      receipt({
        requestId: "request-2",
        result: { requestId: "request-2", journalEntryIds: [], warnings: [] },
      })
    )
    await expect(values.find("book-1", "request-2")).resolves.toMatchObject({
      requestId: "request-2",
    })
  })
  it("participates in snapshot rollback", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentRequestStore(store)
    const before = store.snapshot()
    await values.add(receipt())
    store.restore(before)
    await expect(values.find("book-1", "request-1")).resolves.toBeNull()
  })
})
