import {
  CreateFinancialAccount,
  CreateFinancialBook,
  TransferMoney,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
  createIncomeCategory,
  validBookCommand,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new TransferMoney(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids,
    harness.clock
  )
}

function command(
  sourceAccountId: string,
  destinationAccountId: string,
  overrides: Record<string, string> = {}
) {
  return {
    bookId: "book-1",
    sourceAccountId,
    destinationAccountId,
    amountMinor: "2500",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Move savings",
    ...overrides,
  }
}

async function prepared() {
  const harness = createHarness()
  await createBook(harness)
  const source = await createFinancialAccount(harness, "ASSET")
  const destinationResult = await new CreateFinancialAccount(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute({ bookId: "book-1", name: "Savings", kind: "ASSET" })
  if (!destinationResult.ok) {
    throw new Error(
      `Destination fixture failed: ${destinationResult.error.code}`
    )
  }
  harness.publisher.clear()
  const expense = await createExpenseCategory(harness)
  const income = await createIncomeCategory(harness)
  return {
    harness,
    sourceAccountId: source.id,
    destinationAccountId: destinationResult.value.id,
    expenseCategoryId: expense.id,
    incomeCategoryId: income.id,
  }
}

describe("TransferMoney", () => {
  it("posts only a credit to the source and a debit to the destination", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(
      command(fixture.sourceAccountId, fixture.destinationAccountId)
    )

    expect(result).toEqual({
      ok: true,
      value: {
        id: "entry-1",
        bookId: "book-1",
        occurredOn: "2026-08-04",
        description: "Move savings",
        currency: "BRL",
        version: 0,
      },
    })
    const postings = fixture.harness.store.listJournalEntries()[0]?.postings
    expect(
      postings?.map(({ accountId, amountMinor }) => ({
        accountId,
        amountMinor,
      }))
    ).toEqual([
      { accountId: fixture.sourceAccountId, amountMinor: -2500n },
      { accountId: fixture.destinationAccountId, amountMinor: 2500n },
    ])
    expect(postings?.map(({ accountId }) => accountId)).not.toEqual(
      expect.arrayContaining([
        fixture.expenseCategoryId,
        fixture.incomeCategoryId,
      ])
    )
  })

  it("publishes one serializable JournalEntryPosted event with the exact transfer payload", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(
      command(fixture.sourceAccountId, fixture.destinationAccountId)
    )

    expect(result.ok).toBe(true)
    expect(fixture.harness.publisher.events).toHaveLength(1)
    expect(fixture.harness.publisher.events[0]).toMatchObject({
      type: "JournalEntryPosted",
      aggregateId: "entry-1",
      payload: {
        id: "entry-1",
        postings: [
          {
            accountId: fixture.sourceAccountId,
            amountMinor: "-2500",
            currency: "BRL",
          },
          {
            accountId: fixture.destinationAccountId,
            amountMinor: "2500",
            currency: "BRL",
          },
        ],
      },
    })
    expect(() =>
      JSON.stringify(fixture.harness.publisher.events[0])
    ).not.toThrow()
  })

  it("rejects equal source and destination without writing or publishing", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command(fixture.sourceAccountId, fixture.sourceAccountId)
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SAME_TRANSFER_ACCOUNT" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it.each([
    ["source", "expenseCategoryId", "INVALID_ACCOUNT_KIND"],
    ["destination", "incomeCategoryId", "INVALID_ACCOUNT_KIND"],
  ] as const)(
    "rejects a non-financial %s account without writing or publishing",
    async (side, accountKey, code) => {
      const fixture = await prepared()
      const before = fixture.harness.store.snapshot()
      const sourceAccountId =
        side === "source" ? fixture[accountKey] : fixture.sourceAccountId
      const destinationAccountId =
        side === "destination"
          ? fixture[accountKey]
          : fixture.destinationAccountId

      const result = await useCase(fixture.harness).execute(
        command(sourceAccountId, destinationAccountId)
      )

      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(fixture.harness.store.snapshot()).toEqual(before)
      expect(fixture.harness.publisher.events).toEqual([])
    }
  )

  it("rejects an inactive destination without writing or publishing", async () => {
    const fixture = await prepared()
    const account = fixture.harness.store.getAccount(
      fixture.destinationAccountId as never
    )
    fixture.harness.store.putAccount({
      ...account!,
      status: "ARCHIVED",
      version: 1,
    })
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command(fixture.sourceAccountId, fixture.destinationAccountId)
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_STATUS" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects an account from another book without writing or publishing", async () => {
    const fixture = await prepared()
    const otherBook = await new CreateFinancialBook(
      fixture.harness.transactionManager,
      fixture.harness.dispatcher,
      fixture.harness.ids
    ).execute({ ...validBookCommand, name: "Other book" })
    expect(otherBook.ok).toBe(true)
    const foreignAccount = await new CreateFinancialAccount(
      fixture.harness.transactionManager,
      fixture.harness.dispatcher,
      fixture.harness.ids
    ).execute({ bookId: "book-2", name: "Foreign cash", kind: "ASSET" })
    expect(foreignAccount.ok).toBe(true)
    fixture.harness.publisher.clear()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command(
        fixture.sourceAccountId,
        foreignAccount.ok ? foreignAccount.value.id : "missing"
      )
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects an incompatible currency without writing or publishing", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command(fixture.sourceAccountId, fixture.destinationAccountId, {
        currency: "USD",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CURRENCY_MISMATCH" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects an empty description without writing or publishing", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command(fixture.sourceAccountId, fixture.destinationAccountId, {
        description: "   ",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_JOURNAL_DESCRIPTION" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it.each([
    ["0", "NON_POSITIVE_AMOUNT"],
    ["-1", "NON_POSITIVE_AMOUNT"],
  ] as const)(
    "rejects amount %s without writing or publishing",
    async (amountMinor, code) => {
      const fixture = await prepared()
      const before = fixture.harness.store.snapshot()

      const result = await useCase(fixture.harness).execute(
        command(fixture.sourceAccountId, fixture.destinationAccountId, {
          amountMinor,
        })
      )

      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(fixture.harness.store.snapshot()).toEqual(before)
      expect(fixture.harness.publisher.events).toEqual([])
    }
  )
})
