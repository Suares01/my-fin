import { ApplicationError } from "@workspace/application"
import { FinancialBook } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import {
  financialBookSnapshot,
  InMemoryFinancialBookRepository,
} from "./in-memory-financial-book-repository.js"
import { InMemoryStore } from "../store/in-memory-store.js"

function newBook() {
  return FinancialBook.restore(financialBookSnapshot())
}

describe("InMemoryFinancialBookRepository", () => {
  it("adds and rehydrates a book as an independent aggregate", async () => {
    const store = new InMemoryStore()
    const repository = new InMemoryFinancialBookRepository(store)
    const book = newBook()

    await repository.add(book)
    const loaded = await repository.findById(book.id)

    expect(loaded).not.toBe(book)
    expect(loaded?.toSnapshot()).toEqual(book.toSnapshot())
  })

  it("returns null for an absent book", async () => {
    const repository = new InMemoryFinancialBookRepository(new InMemoryStore())

    expect(await repository.findById("missing" as never)).toBeNull()
  })

  it("rejects a duplicate ID with DUPLICATE_ENTITY", async () => {
    const repository = new InMemoryFinancialBookRepository(new InMemoryStore())
    await repository.add(newBook())

    await expect(repository.add(newBook())).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    } satisfies Partial<ApplicationError>)
  })

  it("saves an exact next version", async () => {
    const store = new InMemoryStore()
    const repository = new InMemoryFinancialBookRepository(store)
    await repository.add(newBook())
    const updated = FinancialBook.restore(
      financialBookSnapshot({ name: "Updated", version: 1 })
    )

    await repository.save(updated, 0)

    expect((await repository.findById(updated.id))?.toSnapshot()).toEqual(
      financialBookSnapshot({ name: "Updated", version: 1 })
    )
  })

  it("rejects a divergent version and preserves the persisted snapshot", async () => {
    const store = new InMemoryStore()
    const repository = new InMemoryFinancialBookRepository(store)
    await repository.add(newBook())
    const invalid = FinancialBook.restore(
      financialBookSnapshot({ name: "Invalid", version: 2 })
    )

    await expect(repository.save(invalid, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    expect(
      (await repository.findById("book-1" as never))?.toSnapshot()
    ).toEqual(financialBookSnapshot())
  })

  it("rejects saving a missing book without creating it", async () => {
    const repository = new InMemoryFinancialBookRepository(new InMemoryStore())
    const book = FinancialBook.restore(financialBookSnapshot({ version: 1 }))

    await expect(repository.save(book, 0)).rejects.toMatchObject({
      code: "ENTITY_NOT_FOUND",
    })
    expect(await repository.findById(book.id)).toBeNull()
  })
})
