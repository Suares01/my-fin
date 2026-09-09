import { ReactivateCategory } from "../../../application/src/ledger/accounts/reactivate-category.js"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new ReactivateCategory(harness.transactionManager, harness.dispatcher)
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    bookId: "book-1",
    categoryId: "account-5",
    expectedVersion: 1,
    ...overrides,
  }
}

function archiveCategory(
  harness: ReturnType<typeof createHarness>,
  version = 1
) {
  harness.store.putAccount({
    ...harness.store.getAccount("account-5" as never)!,
    status: "ARCHIVED",
    version,
  })
}

describe("ReactivateCategory", () => {
  it("reactivates an archived category and preserves its appearance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    archiveCategory(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        kind: "EXPENSE",
        status: "ACTIVE",
        iconKey: "restaurant",
        colorHex: "f43f5e",
        version: 2,
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      status: "ACTIVE",
      iconKey: "restaurant",
      colorHex: "f43f5e",
      version: 2,
    })
    expect(harness.publisher.events).toEqual([
      expect.objectContaining({
        type: "LedgerAccountReactivated",
        aggregateVersion: 2,
        payload: expect.objectContaining({
          iconKey: "restaurant",
          colorHex: "f43f5e",
          status: "ACTIVE",
        }),
      }),
    ])
  })

  it("rejects a repeated reactivation with the consumed version", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    archiveCategory(harness)
    await useCase(harness).execute(command())
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("treats an active category at its current version as a no-op", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute(
      command({ expectedVersion: 0 })
    )

    expect(result).toMatchObject({
      ok: true,
      value: { status: "ACTIVE", iconKey: "restaurant", version: 0 },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a financial account without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    archiveCategory(harness)
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
      command({ categoryId: "account-4", expectedVersion: 0 })
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
    archiveCategory(harness)
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
    archiveCategory(harness, 2)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
