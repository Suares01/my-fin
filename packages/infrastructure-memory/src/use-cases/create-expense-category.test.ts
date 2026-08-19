import { CreateExpenseCategory } from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new CreateExpenseCategory(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  )
}

describe("CreateExpenseCategory", () => {
  it("creates an active EXPENSE category at version zero", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Food",
        kind: "EXPENSE",
        status: "ACTIVE",
        version: 0,
      },
    })
  })

  it("publishes exactly one LedgerAccountCreated with the category payload", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
    })

    expect(result.ok).toBe(true)
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      type: "LedgerAccountCreated",
      aggregateId: "account-5",
      payload: {
        id: "account-5",
        bookId: "book-1",
        name: "Food",
        kind: "EXPENSE",
        status: "ACTIVE",
        version: 0,
      },
    })
  })

  it("rejects a non-EXPENSE kind without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "INCOME",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_KIND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an absent book without exposing other books", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-missing",
      name: "Food",
      kind: "EXPENSE",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an empty category name without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "   ",
      kind: "EXPENSE",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_NAME" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a duplicate normalized EXPENSE category", async () => {
    const harness = createHarness()
    await createBook(harness)
    await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: " food ",
      kind: "EXPENSE",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_ENTITY" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
