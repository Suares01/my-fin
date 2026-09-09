import { CreateExpenseCategory } from "@workspace/application"
import { UpdateCategory } from "../../../application/src/ledger/accounts/update-category.js"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new UpdateCategory(harness.transactionManager, harness.dispatcher)
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    bookId: "book-1",
    categoryId: "account-5",
    expectedVersion: 0,
    name: "Groceries",
    iconKey: "shopping-cart",
    colorHex: "abcdef",
    ...overrides,
  }
}

describe("UpdateCategory", () => {
  it("updates only the category name and preserves its appearance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute(
      command({ name: "  Groceries  " })
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        name: "Groceries",
        kind: "EXPENSE",
        status: "ACTIVE",
        iconKey: "shopping-cart",
        colorHex: "abcdef",
        version: 1,
      },
    })
    expect(harness.publisher.events).toHaveLength(1)
  })

  it("updates only the category icon", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute(
      command({ name: "Food", iconKey: "shopping-cart", colorHex: "f43f5e" })
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        name: "Food",
        iconKey: "shopping-cart",
        colorHex: "f43f5e",
        version: 1,
      },
    })
    expect(harness.publisher.events[0]).toMatchObject({
      type: "CategoryUpdated",
      payload: { iconKey: "shopping-cart", colorHex: "f43f5e" },
    })
  })

  it("updates only the category color", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute(
      command({ name: "Food", iconKey: "restaurant", colorHex: "ABCDEF" })
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        name: "Food",
        iconKey: "restaurant",
        colorHex: "abcdef",
        version: 1,
      },
    })
  })

  it("updates all fields in one version and one CategoryUpdated fact", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      status: "ARCHIVED",
      version: 1,
    })
    harness.publisher.clear()

    const result = await useCase(harness).execute(
      command({
        expectedVersion: 1,
        name: "Dining",
        iconKey: "restaurant",
        colorHex: "ABCDEF",
      })
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        name: "Dining",
        status: "ARCHIVED",
        iconKey: "restaurant",
        colorHex: "abcdef",
        version: 2,
      },
    })
    expect(harness.publisher.events).toEqual([
      expect.objectContaining({
        type: "CategoryUpdated",
        aggregateId: "account-5",
        aggregateVersion: 2,
        payload: expect.objectContaining({
          name: "Dining",
          status: "ARCHIVED",
          iconKey: "restaurant",
          colorHex: "abcdef",
        }),
      }),
    ])
  })

  it("treats canonical-equivalent values as a no-op", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute(
      command({
        name: " Food ",
        iconKey: "restaurant",
        colorHex: "F43F5E",
      })
    )

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Food", version: 0, colorHex: "f43f5e" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a financial account without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CATEGORY_ACCOUNT_REQUIRED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a system account without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ categoryId: "account-3" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CATEGORY_ACCOUNT_REQUIRED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a category from another book without mutation", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      id: "account-other" as never,
      bookId: "book-2" as never,
    })
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ categoryId: "account-other" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a stale version without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ expectedVersion: 4 })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a duplicate normalized name in the same kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    await new CreateExpenseCategory(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({
      bookId: "book-1",
      name: "Groceries",
      kind: "EXPENSE",
      iconKey: "shopping-cart",
      colorHex: "abcdef",
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_ENTITY" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it.each([
    ["name", { name: "   " }, "INVALID_ACCOUNT_NAME"],
    ["icon", { iconKey: "invalid icon" }, "INVALID_CATEGORY_ICON_KEY"],
    ["color", { colorHex: "#abcdef" }, "INVALID_CATEGORY_COLOR"],
  ] as const)("rejects an invalid %s before writing", async (_label, values, code) => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command(values))

    expect(result).toMatchObject({ ok: false, error: { code } })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
