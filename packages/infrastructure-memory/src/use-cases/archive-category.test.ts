import { ArchiveCategory } from "../../../application/src/ledger/accounts/archive-category.js"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new ArchiveCategory(harness.transactionManager, harness.dispatcher)
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    bookId: "book-1",
    categoryId: "account-5",
    expectedVersion: 0,
    ...overrides,
  }
}

describe("ArchiveCategory", () => {
  it("archives an active category and preserves its appearance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        kind: "EXPENSE",
        status: "ARCHIVED",
        iconKey: "restaurant",
        colorHex: "f43f5e",
        version: 1,
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      status: "ARCHIVED",
      iconKey: "restaurant",
      colorHex: "f43f5e",
      version: 1,
    })
    expect(harness.publisher.events).toEqual([
      expect.objectContaining({
        type: "LedgerAccountArchived",
        aggregateVersion: 1,
        payload: expect.objectContaining({
          iconKey: "restaurant",
          colorHex: "f43f5e",
          status: "ARCHIVED",
        }),
      }),
    ])
  })

  it("treats an already archived category at its current version as a no-op", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      status: "ARCHIVED",
      version: 2,
    })
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute(command({ expectedVersion: 2 }))

    expect(result).toMatchObject({
      ok: true,
      value: { status: "ARCHIVED", iconKey: "restaurant", version: 2 },
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
      command({ categoryId: "account-4" })
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
})
