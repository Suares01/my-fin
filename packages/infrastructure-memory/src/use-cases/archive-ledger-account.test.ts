import { ArchiveLedgerAccount } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new ArchiveLedgerAccount(
    harness.transactionManager,
    harness.dispatcher
  )
}

describe("ArchiveLedgerAccount", () => {
  it("archives an active financial account while preserving identity, kind and history", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Checking",
        kind: "ASSET",
        status: "ARCHIVED",
        version: 1,
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      id: "account-5",
      kind: "ASSET",
      status: "ARCHIVED",
      version: 1,
    })
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      type: "LedgerAccountArchived",
      aggregateId: "account-5",
      bookId: "book-1",
      aggregateVersion: 1,
      payload: {
        kind: "ASSET",
        name: "Checking",
        status: "ARCHIVED",
      },
    })
  })

  it("archives an expense category without changing its kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        kind: "EXPENSE",
        status: "ARCHIVED",
        version: 1,
      },
    })
  })

  it("archives an income category without changing its kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    const { CreateIncomeCategory } = await import("@workspace/application")
    await new CreateIncomeCategory(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({ bookId: "book-1", name: "Salary", kind: "INCOME" })
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { kind: "INCOME", status: "ARCHIVED", version: 1 },
    })
  })

  it("is idempotent for an already archived account", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      status: "ARCHIVED",
      version: 1,
    })
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { status: "ARCHIVED", version: 1 },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects archiving a system account without writing", async () => {
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
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an account from another book before mutation", async () => {
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
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects a missing account", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "missing",
      expectedVersion: 0,
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
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-missing",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("does not alter the account name or version when archiving", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Checking", kind: "ASSET", version: 1 },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      normalizedName: "checking",
    })
  })

  it("does not publish a fact when the domain transition is already complete", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createExpenseCategory(harness)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      status: "ARCHIVED",
      version: 3,
    })
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 3,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { version: 3, status: "ARCHIVED" },
    })
    expect(harness.publisher.events).toEqual([])
  })
})
