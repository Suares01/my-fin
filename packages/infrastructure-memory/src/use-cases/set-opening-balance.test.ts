import {
  CreateFinancialAccount,
  ReverseJournalEntry,
  SetOpeningBalance,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new SetOpeningBalance(
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
    amountMinor: "10000",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Opening balance",
    ...overrides,
  }
}

describe("SetOpeningBalance", () => {
  it("rejects a second active opening balance without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)

    expect((await useCase(harness).execute(command())).ok).toBe(true)
    harness.publisher.clear()
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ amountMinor: "20000" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPENING_BALANCE_ALREADY_SET" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("allows a new opening balance after the previous one is reversed", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)

    expect((await useCase(harness).execute(command())).ok).toBe(true)
    const reversal = await new ReverseJournalEntry(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids,
      harness.clock
    ).execute({
      bookId: "book-1",
      journalEntryId: "entry-1",
      expectedVersion: 0,
      occurredOn: "2026-08-05",
      description: "Reverse opening",
    })
    expect(reversal.ok).toBe(true)

    const replacement = await useCase(harness).execute(
      command({ amountMinor: "20000" })
    )

    expect(replacement).toMatchObject({ ok: true, value: { id: "entry-3" } })
    expect(harness.store.listJournalEntries()).toHaveLength(3)
  })

  it("isolates active opening balances by account and book", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const secondAccount = await new CreateFinancialAccount(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({ bookId: "book-1", name: "Savings", type: "OTHER_ASSET" })
    expect(secondAccount.ok).toBe(true)
    const firstBookSecondAccount = await useCase(harness).execute(command())
    expect(firstBookSecondAccount.ok).toBe(true)
    const secondAccountOpening = await useCase(harness).execute(
      command({ accountId: "account-6" })
    )
    expect(secondAccountOpening.ok).toBe(true)

    await createBook(harness)
    const secondBookAccount = await new CreateFinancialAccount(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({ bookId: "book-2", name: "Other cash", type: "OTHER_ASSET" })
    expect(secondBookAccount.ok).toBe(true)
    const secondBookOpening = await useCase(harness).execute(
      command({ bookId: "book-2", accountId: "account-11" })
    )

    expect(secondBookOpening.ok).toBe(true)
  })

  it("posts a positive debit to an ASSET and a credit to opening balance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness, "ASSET")

    const result = await useCase(harness).execute(command())

    expect(result).toEqual({
      ok: true,
      value: {
        id: "entry-1",
        bookId: "book-1",
        occurredOn: "2026-08-04",
        description: "Opening balance",
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
      { accountId: "account-5", amountMinor: 10000n },
      { accountId: "account-1", amountMinor: -10000n },
    ])
  })

  it("posts a credit to a LIABILITY and a debit to opening balance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness, "LIABILITY")

    const result = await useCase(harness).execute(
      command({ accountId: "account-5" })
    )

    expect(result.ok).toBe(true)
    expect(
      harness.store
        .listJournalEntries()[0]
        ?.postings.map(({ accountId, amountMinor }) => ({
          accountId,
          amountMinor,
        }))
    ).toEqual([
      { accountId: "account-5", amountMinor: -10000n },
      { accountId: "account-1", amountMinor: 10000n },
    ])
  })

  it("publishes one serializable JournalEntryPosted event after commit", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)

    const result = await useCase(harness).execute(command())

    expect(result.ok).toBe(true)
    expect(harness.publisher.events).toHaveLength(1)
    expect(harness.publisher.events[0]).toMatchObject({
      eventId: "event-7",
      type: "JournalEntryPosted",
      aggregateId: "entry-1",
      bookId: "book-1",
      payload: {
        id: "entry-1",
        currency: "BRL",
        postings: [
          {
            id: "posting-1",
            accountId: "account-5",
            amountMinor: "10000",
            currency: "BRL",
          },
          {
            id: "posting-2",
            accountId: "account-1",
            amountMinor: "-10000",
            currency: "BRL",
          },
        ],
      },
    })
    expect(() => JSON.stringify(harness.publisher.events[0])).not.toThrow()
  })

  it.each([
    ["0", "NON_POSITIVE_AMOUNT"],
    ["-1", "NON_POSITIVE_AMOUNT"],
  ] as const)(
    "rejects amount %s without writing or publishing",
    async (amountMinor, code) => {
      const harness = createHarness()
      await createBook(harness)
      await createFinancialAccount(harness)
      const before = harness.store.snapshot()

      const result = await useCase(harness).execute(command({ amountMinor }))

      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(harness.store.snapshot()).toEqual(before)
      expect(harness.publisher.events).toEqual([])
    }
  )

  it("rejects a currency different from the book base currency", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(command({ currency: "USD" }))

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CURRENCY_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a category or system account as the opening balance target", async () => {
    const harness = createHarness()
    await createBook(harness)
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

  it("rejects an inactive account without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
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

  it("rejects a missing account without writing or publishing", async () => {
    const harness = createHarness()
    await createBook(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute(
      command({ accountId: "account-missing" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })
})
