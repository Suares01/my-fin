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
  it("creates an active financial account from its type at version zero", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "  Checking  ",
      type: "BANK_ACCOUNT",
      institutionName: "  Banco A  ",
      displayReference: "  1234  ",
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
        financialAccount: {
          type: "BANK_ACCOUNT",
          institutionName: "Banco A",
          displayReference: "1234",
        },
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      bookId: "book-1",
      name: "Checking",
      kind: "ASSET",
      status: "ACTIVE",
      version: 0,
      financialAccount: {
        type: "BANK_ACCOUNT",
        institutionName: "Banco A",
        displayReference: "1234",
      },
    })
  })

  it("creates a credit card with the exact serializable financial profile", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Credit card",
      type: "CREDIT_CARD",
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
        financialAccount: { type: "CREDIT_CARD" },
      },
    })
  })

  it("creates an investment account with its optional settlement reference", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Brokerage",
      type: "INVESTMENT_ACCOUNT",
      defaultSettlementAccountId: "account-99",
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: "ASSET",
        financialAccount: {
          type: "INVESTMENT_ACCOUNT",
          investment: { defaultSettlementAccountId: "account-99" },
        },
      },
    })
    expect(harness.store.getAccount("account-5" as never)?.financialAccount).toEqual({
      type: "INVESTMENT_ACCOUNT",
      investment: { defaultSettlementAccountId: "account-99" },
    })
  })

  it("rejects a settlement reference on a non-investment financial type", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Checking",
      type: "BANK_ACCOUNT",
      defaultSettlementAccountId: "account-99",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_FINANCIAL_ACCOUNT_PROFILE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("normalizes omitted profile text without inventing another identity", async () => {
    const harness = createHarness()
    await createBook(harness)

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Cash",
      type: "CASH",
      institutionName: "   ",
      displayReference: "   ",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { id: "account-5", financialAccount: { type: "CASH" } },
    })
    expect(result.ok && result.value.financialAccount).toEqual({ type: "CASH" })
  })

  it("rejects an unsupported financial type without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: "Food",
      type: "EXPENSE",
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
      type: "BANK_ACCOUNT",
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
      type: "BANK_ACCOUNT",
    })
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const duplicate = await useCase(harness).execute({
      bookId: "book-1",
      name: "  CHECKING  ",
      type: "BANK_ACCOUNT",
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
      type: "BANK_ACCOUNT",
    })

    const result = await useCase(harness).execute({
      bookId: "book-1",
      name: " card ",
      type: "CREDIT_CARD",
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
      type: "BANK_ACCOUNT",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_NAME" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
