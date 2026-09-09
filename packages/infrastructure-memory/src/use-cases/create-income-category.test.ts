import { CreateIncomeCategory } from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new CreateIncomeCategory(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  )
}

const incomeAppearance = {
  iconKey: "briefcase",
  colorHex: "10B981",
} as const

describe("CreateIncomeCategory", () => {
  it("creates an active INCOME category at version zero", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Salary",
      kind: "INCOME",
      ...incomeAppearance,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Salary",
        kind: "INCOME",
        status: "ACTIVE",
        iconKey: "briefcase",
        colorHex: "10b981",
        version: 0,
      },
    })
  })

  it("publishes exactly one LedgerAccountCreated with the category payload", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Salary",
      kind: "INCOME",
      ...incomeAppearance,
    })

    expect(result.ok).toBe(true)
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      type: "LedgerAccountCreated",
      aggregateId: "account-5",
      payload: {
        id: "account-5",
        bookId: "book-1",
        name: "Salary",
        kind: "INCOME",
        status: "ACTIVE",
        iconKey: "briefcase",
        colorHex: "10b981",
        version: 0,
      },
    })
  })

  it("persists the canonical income appearance in the store", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Salary",
      kind: "INCOME",
      iconKey: "briefcase",
      colorHex: "10B981",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { iconKey: "briefcase", colorHex: "10b981" },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      kind: "INCOME",
      iconKey: "briefcase",
      colorHex: "10b981",
    })
  })

  it("rejects a non-INCOME kind without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Salary",
      kind: "EXPENSE",
      ...incomeAppearance,
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
      name: "Salary",
      kind: "INCOME",
      ...incomeAppearance,
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
      kind: "INCOME",
      ...incomeAppearance,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_NAME" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a duplicate normalized INCOME category", async () => {
    const harness = createHarness()
    await createBook(harness)
    await useCase(harness).execute({
      bookId: "book-1",
      name: "Salary",
      kind: "INCOME",
      ...incomeAppearance,
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: " salary ",
      kind: "INCOME",
      ...incomeAppearance,
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
      name: "Salary",
      kind: "INCOME",
      ...incomeAppearance,
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
      name: "Salary",
      kind: "INCOME",
      ...incomeAppearance,
      colorHex: "#10b981",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CATEGORY_COLOR" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
