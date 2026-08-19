import { RecordIncome } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
  createIncomeCategory,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new RecordIncome(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids,
    harness.clock
  )
}

function command(overrides: Record<string, string> = {}) {
  return {
    bookId: "book-1",
    accountId: "account-5",
    categoryId: "account-6",
    amountMinor: "2500",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Salary",
    ...overrides,
  }
}

async function prepared() {
  const harness = createHarness()
  await createBook(harness)
  await createFinancialAccount(harness)
  await createIncomeCategory(harness)
  return harness
}

describe("RecordIncome", () => {
  it("posts a debit to the financial account and a credit to the INCOME category", async () => {
    const harness = await prepared()

    const result = await useCase(harness).execute(command())

    expect(result).toEqual({
      ok: true,
      value: {
        id: "entry-1",
        bookId: "book-1",
        occurredOn: "2026-08-04",
        description: "Salary",
        currency: "BRL",
        version: 0,
      },
    })
    expect(
      harness.store
        .listJournalEntries()[0]
        ?.postings.map(({ accountId, amountMinor }) => ({
          accountId,
          amountMinor,
        }))
    ).toEqual([
      { accountId: "account-5", amountMinor: 2500n },
      { accountId: "account-6", amountMinor: -2500n },
    ])
  })

  it("publishes one JournalEntryPosted event with exact serializable amounts", async () => {
    const harness = await prepared()

    const result = await useCase(harness).execute(command())

    expect(result.ok).toBe(true)
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      type: "JournalEntryPosted",
      aggregateId: "entry-1",
      payload: {
        id: "entry-1",
        postings: [
          { accountId: "account-5", amountMinor: "2500", currency: "BRL" },
          { accountId: "account-6", amountMinor: "-2500", currency: "BRL" },
        ],
      },
    })
    expect(() => JSON.stringify(harness.publisher.events[0])).not.toThrow()
  })

  it("rejects an EXPENSE category as an income category", async () => {
    const harness = await prepared()
    await createExpenseCategory(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ categoryId: "account-7" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_KIND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a non-financial account as the account side", async () => {
    const harness = await prepared()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ accountId: "account-1" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_KIND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it.each([
    ["0", "NON_POSITIVE_AMOUNT"],
    ["-1", "NON_POSITIVE_AMOUNT"],
  ] as const)(
    "rejects amount %s without writing or publishing",
    async (amountMinor, code) => {
      const harness = await prepared()
      const before = harness.store.snapshot()

      const result = await useCase(harness).execute(command({ amountMinor }))

      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(harness.store.snapshot()).toEqual(before)
      expect(harness.publisher.events).toEqual([])
    }
  )

  it("rejects an incompatible currency without writing or publishing", async () => {
    const harness = await prepared()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command({ currency: "USD" }))

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CURRENCY_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an inactive financial account without writing or publishing", async () => {
    const harness = await prepared()
    const account = harness.store.getAccount("account-5" as never)
    harness.store.putAccount({ ...account!, status: "ARCHIVED", version: 1 })
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command())

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_STATUS" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects an empty description without writing or publishing", async () => {
    const harness = await prepared()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ description: "   " })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_JOURNAL_DESCRIPTION" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a missing income category without writing or publishing", async () => {
    const harness = await prepared()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ categoryId: "category-missing" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
