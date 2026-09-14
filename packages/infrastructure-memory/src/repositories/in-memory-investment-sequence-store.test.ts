import { describe, expect, it } from "vitest"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentSequenceStore } from "./in-memory-investment-sequence-store.js"

const MAX = "9223372036854775807"

describe("InMemoryInvestmentSequenceStore", () => {
  it("reserves an exact positive sequence from one", async () => {
    const values = new InMemoryInvestmentSequenceStore(new InMemoryStore())
    await expect(values.next("book-1")).resolves.toBe("1")
  })
  it("increments without number coercion", async () => {
    const store = new InMemoryStore()
    store.restore({
      ...store.snapshot(),
      investmentSequences: [
        { bookId: "book-1" as never, lastSequence: "9007199254740992" },
      ],
    })
    const values = new InMemoryInvestmentSequenceStore(store)
    await expect(values.next("book-1")).resolves.toBe("9007199254740993")
  })
  it("keeps each book independent", async () => {
    const values = new InMemoryInvestmentSequenceStore(new InMemoryStore())
    await values.next("book-1")
    await expect(values.next("book-2")).resolves.toBe("1")
  })
  it("shares the sequence stream used by operations and valuations", async () => {
    const values = new InMemoryInvestmentSequenceStore(new InMemoryStore())
    await expect(values.next("book-1")).resolves.toBe("1")
    await expect(values.next("book-1")).resolves.toBe("2")
  })
  it("rejects the supported integer limit", async () => {
    const store = new InMemoryStore()
    store.restore({
      ...store.snapshot(),
      investmentSequences: [{ bookId: "book-1" as never, lastSequence: MAX }],
    })
    const values = new InMemoryInvestmentSequenceStore(store)
    await expect(values.next("book-1")).rejects.toMatchObject({
      code: "UNEXPECTED_ERROR",
    })
  })
  it("restores a failed reservation without collision", async () => {
    const store = new InMemoryStore(),
      values = new InMemoryInvestmentSequenceStore(store)
    const before = store.snapshot()
    await values.next("book-1")
    store.restore(before)
    await expect(values.next("book-1")).resolves.toBe("1")
  })
})
