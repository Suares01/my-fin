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

const expenseAppearance = {
  iconKey: "restaurant",
  colorHex: "F43F5E",
} as const

describe("CreateExpenseCategory", () => {
  it("creates an active EXPENSE category at version zero", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
      ...expenseAppearance,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Food",
        kind: "EXPENSE",
        status: "ACTIVE",
        iconKey: "restaurant",
        colorHex: "f43f5e",
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
      ...expenseAppearance,
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
        iconKey: "restaurant",
        colorHex: "f43f5e",
        version: 0,
      },
    })
  })

  it("persists the canonical expense appearance in the store", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
      iconKey: "restaurant",
      colorHex: "F43F5E",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { iconKey: "restaurant", colorHex: "f43f5e" },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      kind: "EXPENSE",
      iconKey: "restaurant",
      colorHex: "f43f5e",
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
      ...expenseAppearance,
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
      ...expenseAppearance,
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
      ...expenseAppearance,
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
      ...expenseAppearance,
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: " food ",
      kind: "EXPENSE",
      ...expenseAppearance,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_ENTITY" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an invalid icon without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
      ...expenseAppearance,
      iconKey: "invalid icon",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CATEGORY_ICON_KEY" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an invalid color without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
      ...expenseAppearance,
      colorHex: "f43f5e99",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CATEGORY_COLOR" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
