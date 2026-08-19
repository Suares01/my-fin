import { RenameLedgerAccount } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new RenameLedgerAccount(harness.transactionManager, harness.dispatcher)
}

describe("RenameLedgerAccount", () => {
  it("renames a financial account while preserving identity, kind and status", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      name: "  Main cash  ",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Main cash",
        kind: "ASSET",
        status: "ACTIVE",
        version: 1,
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      id: "account-5",
      name: "Main cash",
      normalizedName: "main cash",
      kind: "ASSET",
      status: "ACTIVE",
      version: 1,
    })
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      type: "LedgerAccountRenamed",
      aggregateId: "account-5",
      bookId: "book-1",
      aggregateVersion: 1,
      payload: {
        kind: "ASSET",
        status: "ACTIVE",
        name: "Main cash",
      },
    })
  })

  it("renames an archived category without reactivating it", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      status: "ARCHIVED",
      version: 1,
    })
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
      name: "Groceries",
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        name: "Groceries",
        kind: "EXPENSE",
        status: "ARCHIVED",
        version: 2,
      },
    })
  })

  it("allows a case or spacing change when the normalized name is still unique to itself", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      name: "  CHECKING  ",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { name: "CHECKING", version: 1 },
    })
  })

  it("treats the exact current display name as an idempotent no-op", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      name: "Checking",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { version: 0, name: "Checking" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a normalized-name collision in the same book and kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    await new (await import("@workspace/application")).CreateFinancialAccount(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({ bookId: "book-1", name: "Savings", kind: "ASSET" })
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      name: "  SAVINGS  ",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_ENTITY" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("allows the same normalized name for a different kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const { CreateFinancialAccount } = await import("@workspace/application")
    await new CreateFinancialAccount(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({ bookId: "book-1", name: "Checking", kind: "LIABILITY" })

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      name: "Checking",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { id: "account-5", version: 0 },
    })
  })

  it.each([
    ["empty name", "   ", "INVALID_ACCOUNT_NAME"],
    ["system account", "Opening renamed", "SYSTEM_ACCOUNT_PROTECTED"],
  ] as const)("rejects %s without writing", async (_label, name, code) => {
    const harness = createHarness()
    await createBook(harness)
    if (code === "INVALID_ACCOUNT_NAME") {
      await createFinancialAccount(harness)
    }
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId:
        code === "SYSTEM_ACCOUNT_PROTECTED" ? "account-1" : "account-5",
      expectedVersion: 0,
      name,
    })

    expect(result).toMatchObject({ ok: false, error: { code } })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a missing account", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "missing",
      expectedVersion: 0,
      name: "Cash",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a cross-book account before mutation", async () => {
    const harness = createHarness()
    await createBook(harness)
    harness.store.putAccount({
      id: "account-other" as never,
      bookId: "book-2" as never,
      name: "Other",
      normalizedName: "other",
      kind: "ASSET",
      status: "ACTIVE",
      version: 0,
    })
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-other",
      expectedVersion: 0,
      name: "Changed",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a stale expected version without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 4,
      name: "Changed",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a missing book without exposing account data", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-missing",
      accountId: "account-5",
      expectedVersion: 0,
      name: "Changed",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })
})
