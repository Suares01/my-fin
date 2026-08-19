import { CreateFinancialAccount } from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new CreateFinancialAccount(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  )
}

describe("CreateFinancialAccount", () => {
  it("creates an active ASSET account at version zero", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "  Checking  ",
      kind: "ASSET",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: "account-5",
        bookId: "book-1",
        name: "Checking",
        kind: "ASSET",
        status: "ACTIVE",
        version: 0,
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      bookId: "book-1",
      name: "Checking",
      kind: "ASSET",
      status: "ACTIVE",
      version: 0,
    })
  })

  it("creates a LIABILITY account with the exact serializable event payload", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Credit card",
      kind: "LIABILITY",
    })

    expect(result.ok).toBe(true)
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      eventId: "event-6",
      type: "LedgerAccountCreated",
      aggregateId: "account-5",
      bookId: "book-1",
      payload: {
        id: "account-5",
        bookId: "book-1",
        name: "Credit card",
        kind: "LIABILITY",
        status: "ACTIVE",
        version: 0,
      },
    })
  })

  it("rejects an unsupported kind without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      kind: "EXPENSE",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_KIND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a missing book without exposing another book's data", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-missing",
      name: "Checking",
      kind: "ASSET",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a duplicate normalized name for the same book and kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    const first = await useCase(harness).execute({
      bookId: "book-1",
      name: "Checking",
      kind: "ASSET",
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const duplicate = await useCase(harness).execute({
      bookId: "book-1",
      name: "  CHECKING  ",
      kind: "ASSET",
    })

    expect(first.ok).toBe(true)
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "DUPLICATE_ENTITY" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("allows the same normalized name for a different account kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await useCase(harness).execute({
      bookId: "book-1",
      name: "Card",
      kind: "ASSET",
    })

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: " card ",
      kind: "LIABILITY",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { id: "account-6", name: "card", kind: "LIABILITY", version: 0 },
    })
    expect(
      harness.store
        .listAccounts()
        .filter(({ normalizedName }) => normalizedName === "card")
    ).toHaveLength(2)
  })

  it("returns no event when the account name is invalid", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "   ",
      kind: "ASSET",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_NAME" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
