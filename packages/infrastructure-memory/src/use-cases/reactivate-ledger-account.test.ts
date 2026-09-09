import { ReactivateLedgerAccount } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new ReactivateLedgerAccount(
    harness.transactionManager,
    harness.dispatcher
  )
}

function archiveAccount(
  harness: ReturnType<typeof createHarness>,
  version = 1
) {
  harness.store.putAccount({
    ...harness.store.getAccount("account-5" as never)!,
    status: "ARCHIVED",
    version,
  })
}

describe("ReactivateLedgerAccount", () => {
  it("reactivates an archived financial account preserving identity, kind and history", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    archiveAccount(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Checking",
        kind: "ASSET",
        status: "ACTIVE",
        version: 2,
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      id: "account-5",
      kind: "ASSET",
      status: "ACTIVE",
      version: 2,
    })
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      type: "LedgerAccountReactivated",
      aggregateId: "account-5",
      bookId: "book-1",
      aggregateVersion: 2,
      payload: {
        kind: "ASSET",
        name: "Checking",
        status: "ACTIVE",
      },
    })
  })

  it("reactivates an archived expense category without changing its kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    archiveAccount(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { id: "account-5", kind: "EXPENSE", status: "ACTIVE", version: 2 },
    })
  })

  it("reactivates an archived income category without changing its kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    const { CreateIncomeCategory } = await import("@workspace/application")
    await new CreateIncomeCategory(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({
      bookId: "book-1",
      name: "Salary",
      kind: "INCOME",
      iconKey: "briefcase",
      colorHex: "10b981",
    })
    archiveAccount(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { kind: "INCOME", status: "ACTIVE", version: 2 },
    })
  })

  it("is idempotent for an already active financial account", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { status: "ACTIVE", version: 0 },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("is idempotent for an already active category at a later version", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      version: 4,
    })
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 4,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { status: "ACTIVE", version: 4 },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects reactivating a system account without writing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-1",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SYSTEM_ACCOUNT_PROTECTED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
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
      status: "ARCHIVED",
      version: 1,
    })
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-other",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a stale expected version without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    archiveAccount(harness, 2)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a missing account without writing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "missing",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a missing book without exposing account data", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    archiveAccount(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-missing",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("preserves the account name and normalized name during reactivation", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      name: "Main cash",
      normalizedName: "main cash",
      status: "ARCHIVED",
      version: 1,
    })

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Main cash", version: 2 },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      name: "Main cash",
      normalizedName: "main cash",
      kind: "ASSET",
      status: "ACTIVE",
    })
  })
})
