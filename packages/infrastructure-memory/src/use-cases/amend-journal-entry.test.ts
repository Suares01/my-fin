import {
  AmendJournalEntry,
  ApplicationError,
  CreateFinancialBook,
  CreateFinancialAccount,
  RecordExpense,
  ReverseJournalEntry,
  type RepositoryContext,
  type TransactionManager,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
  createIncomeCategory,
} from "./test-helpers.js"

function useCase(
  harness: ReturnType<typeof createHarness>,
  transactionManager: TransactionManager = harness.transactionManager
) {
  return new AmendJournalEntry(
    transactionManager,
    harness.dispatcher,
    harness.ids,
    harness.clock
  )
}

function amendmentCommand(
  journalEntryId: string,
  replacement: Record<string, string>,
  overrides: Partial<{
    bookId: string
    journalEntryId: string
    expectedVersion: number
  }> = {}
) {
  return {
    bookId: "book-1",
    journalEntryId,
    expectedVersion: 0,
    replacement,
    ...overrides,
  } as never
}

async function prepared() {
  const harness = createHarness()
  await createBook(harness)
  const account = await createFinancialAccount(harness)
  const category = await createExpenseCategory(harness)
  const destination = await new CreateFinancialAccount(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute({ bookId: "book-1", name: "Savings", kind: "ASSET" })
  if (!destination.ok) {
    throw new Error(`Destination fixture failed: ${destination.error.code}`)
  }
  const incomeCategory = await createIncomeCategory(harness)
  const expense = await new RecordExpense(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids,
    harness.clock
  ).execute({
    bookId: "book-1",
    accountId: account.id,
    categoryId: category.id,
    amountMinor: "2500",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Lunch",
  })
  if (!expense.ok) {
    throw new Error(`Journal fixture failed: ${expense.error.code}`)
  }
  harness.publisher.clear()
  return {
    harness,
    account,
    category,
    destination: destination.value,
    incomeCategory,
    originalId: expense.value.id,
  }
}

function conflictTransactionManager(
  base: TransactionManager
): TransactionManager {
  return {
    execute<T>(work: (repositories: RepositoryContext) => Promise<T>) {
      return base.execute((repositories) =>
        work({
          ...repositories,
          journalEntries: {
            findById: repositories.journalEntries.findById.bind(
              repositories.journalEntries
            ),
            findActiveOpeningBalanceByAccount:
              repositories.journalEntries.findActiveOpeningBalanceByAccount.bind(
                repositories.journalEntries
              ),
            reserveNextSequence:
              repositories.journalEntries.reserveNextSequence.bind(
                repositories.journalEntries
              ),
            add: repositories.journalEntries.add.bind(
              repositories.journalEntries
            ),
            save: async () => {
              throw new ApplicationError(
                "OPTIMISTIC_CONCURRENCY_FAILURE",
                "Journal entry changed during amendment"
              )
            },
          },
        })
      )
    },
  }
}

describe("AmendJournalEntry", () => {
  it("amends an expense with target-date reversal, requested-date replacement and exact lineage", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: fixture.destination.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-10",
        description: "Dinner",
      })
    )

    expect(result).toEqual({
      ok: true,
      value: {
        targetId: "entry-1",
        reversalId: "entry-2",
        replacementId: "entry-3",
        replacementVersion: 0,
        state: "EFFECTIVE",
      },
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-1" as never)
    ).toMatchObject({
      occurredOn: "2026-08-04",
      reversedBy: "entry-2",
      replacedBy: "entry-3",
      version: 1,
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-2" as never)
    ).toMatchObject({
      reversalOf: "entry-1",
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T12:00:00.000Z",
      sequence: "2",
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-3" as never)
    ).toMatchObject({
      replacementOf: "entry-1",
      occurredOn: "2026-08-10",
      recordedAt: "2026-08-04T12:00:00.000Z",
      sequence: "3",
      description: "Dinner",
      postings: [
        { accountId: fixture.category.id, amountMinor: 3000n },
        { accountId: fixture.destination.id, amountMinor: -3000n },
      ],
    })
    expect(fixture.harness.publisher.events.map(({ type }) => type)).toEqual([
      "JournalEntryPosted",
      "JournalEntryPosted",
      "JournalEntryAmended",
    ])
    expect(fixture.harness.publisher.events[2]?.payload).toEqual({
      bookId: "book-1",
      originalId: "entry-1",
      reversalId: "entry-2",
      replacementId: "entry-3",
    })
  })

  it("creates an opening-balance replacement through the opening-balance variant", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "OPENING_BALANCE",
        accountId: fixture.account.id,
        amountMinor: "3100",
        currency: "BRL",
        occurredOn: "2026-08-11",
        description: "Opening correction",
      })
    )

    expect(result.ok).toBe(true)
    expect(
      fixture.harness.store.getJournalEntry("entry-3" as never)
    ).toMatchObject({
      replacementOf: fixture.originalId,
      occurredOn: "2026-08-11",
      postings: [
        { accountId: fixture.account.id, amountMinor: 3100n },
        { accountId: "account-1", amountMinor: -3100n },
      ],
    })
  })

  it("creates an income replacement through the income variant", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "INCOME",
        accountId: fixture.account.id,
        categoryId: fixture.incomeCategory.id,
        amountMinor: "4500",
        currency: "BRL",
        occurredOn: "2026-08-12",
        description: "Refund",
      })
    )

    expect(result.ok).toBe(true)
    expect(
      fixture.harness.store.getJournalEntry("entry-3" as never)
    ).toMatchObject({
      replacementOf: fixture.originalId,
      postings: [
        { accountId: fixture.account.id, amountMinor: 4500n },
        { accountId: fixture.incomeCategory.id, amountMinor: -4500n },
      ],
    })
  })

  it("creates a transfer replacement with opposite postings", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "TRANSFER",
        sourceAccountId: fixture.account.id,
        destinationAccountId: fixture.destination.id,
        amountMinor: "5000",
        currency: "BRL",
        occurredOn: "2026-08-13",
        description: "Move money",
      })
    )

    expect(result.ok).toBe(true)
    expect(
      fixture.harness.store.getJournalEntry("entry-3" as never)
    ).toMatchObject({
      replacementOf: fixture.originalId,
      postings: [
        { accountId: fixture.account.id, amountMinor: -5000n },
        { accountId: fixture.destination.id, amountMinor: 5000n },
      ],
    })
  })

  it("amends only the effective replacement on a second amendment", async () => {
    const fixture = await prepared()
    const first = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: fixture.account.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-05",
        description: "First correction",
      })
    )
    if (!first.ok) throw new Error(first.error.code)
    fixture.harness.publisher.clear()

    const second = await useCase(fixture.harness).execute(
      amendmentCommand(first.value.replacementId, {
        type: "EXPENSE",
        accountId: fixture.destination.id,
        categoryId: fixture.category.id,
        amountMinor: "3500",
        currency: "BRL",
        occurredOn: "2026-08-06",
        description: "Second correction",
      })
    )

    expect(second).toMatchObject({
      ok: true,
      value: {
        targetId: "entry-3",
        reversalId: "entry-4",
        replacementId: "entry-5",
      },
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-1" as never)
    ).toMatchObject({
      reversedBy: "entry-2",
      replacedBy: "entry-3",
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-3" as never)
    ).toMatchObject({
      replacementOf: "entry-1",
      reversedBy: "entry-4",
      replacedBy: "entry-5",
    })
    expect(
      fixture.harness.store
        .listJournalEntries()
        .filter(
          (entry) =>
            entry.replacedBy === undefined && entry.reversalOf === undefined
        )
    ).toHaveLength(1)
  })

  it("allocates distinct consecutive sequences for every amendment entry", async () => {
    const fixture = await prepared()
    const first = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: fixture.account.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-05",
        description: "First correction",
      })
    )
    if (!first.ok) throw new Error(first.error.code)
    const second = await useCase(fixture.harness).execute(
      amendmentCommand(first.value.replacementId, {
        type: "EXPENSE",
        accountId: fixture.account.id,
        categoryId: fixture.category.id,
        amountMinor: "3500",
        currency: "BRL",
        occurredOn: "2026-08-06",
        description: "Second correction",
      })
    )
    expect(second.ok).toBe(true)
    expect(
      fixture.harness.store.listJournalEntries().map((entry) => entry.sequence)
    ).toEqual(["1", "2", "3", "4", "5"])
    expect(
      new Set(
        fixture.harness.store.listJournalEntries().map((entry) => entry.id)
      ).size
    ).toBe(5)
  })

  it("rejects a stale replacement version without changing the first amendment", async () => {
    const fixture = await prepared()
    const first = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: fixture.account.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-05",
        description: "First correction",
      })
    )
    if (!first.ok) throw new Error(first.error.code)
    fixture.harness.publisher.clear()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(
        first.value.replacementId,
        {
          type: "EXPENSE",
          accountId: fixture.account.id,
          categoryId: fixture.category.id,
          amountMinor: "3500",
          currency: "BRL",
          occurredOn: "2026-08-06",
          description: "Rejected",
        },
        { expectedVersion: 1 }
      )
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it.each([
    ["reversal", "entry-2", 0],
    ["amended predecessor", "entry-1", 1],
  ] as const)(
    "rejects amending an ineffective %s",
    async (_label, targetId, expectedVersion) => {
      const fixture = await prepared()
      if (targetId === "entry-2") {
        const reversal = await new ReverseJournalEntry(
          fixture.harness.transactionManager,
          fixture.harness.dispatcher,
          fixture.harness.ids,
          fixture.harness.clock
        ).execute({
          bookId: "book-1",
          journalEntryId: fixture.originalId,
          expectedVersion: 0,
          occurredOn: "2026-08-05",
          description: "Cancel",
        })
        expect(reversal.ok).toBe(true)
        fixture.harness.publisher.clear()
      } else {
        const first = await useCase(fixture.harness).execute(
          amendmentCommand(fixture.originalId, {
            type: "EXPENSE",
            accountId: fixture.account.id,
            categoryId: fixture.category.id,
            amountMinor: "3000",
            currency: "BRL",
            occurredOn: "2026-08-05",
            description: "Correction",
          })
        )
        expect(first.ok).toBe(true)
        fixture.harness.publisher.clear()
      }
      const before = fixture.harness.store.snapshot()

      const result = await useCase(fixture.harness).execute(
        amendmentCommand(
          targetId,
          {
            type: "EXPENSE",
            accountId: fixture.account.id,
            categoryId: fixture.category.id,
            amountMinor: "3000",
            currency: "BRL",
            occurredOn: "2026-08-06",
            description: "Rejected",
          },
          { expectedVersion }
        )
      )

      expect(result).toMatchObject({
        ok: false,
        error: { code: "JOURNAL_ENTRY_NOT_EFFECTIVE" },
      })
      expect(fixture.harness.store.snapshot()).toEqual(before)
      expect(fixture.harness.publisher.events).toEqual([])
    }
  )

  it.each([
    ["missing book", { bookId: "missing" }, "ENTITY_NOT_FOUND"],
    ["missing target", { journalEntryId: "missing" }, "ENTITY_NOT_FOUND"],
    [
      "version conflict",
      { expectedVersion: 1 },
      "OPTIMISTIC_CONCURRENCY_FAILURE",
    ],
    ["book mismatch", { bookId: "book-2" }, "BOOK_MISMATCH"],
  ] as const)("rejects %s without writes", async (_label, overrides, code) => {
    const fixture = await prepared()
    if ("bookId" in overrides && overrides.bookId === "book-2") {
      const otherBook = await new CreateFinancialBook(
        fixture.harness.transactionManager,
        fixture.harness.dispatcher,
        fixture.harness.ids
      ).execute({ name: "Other", baseCurrency: "BRL", timezone: "UTC" })
      expect(otherBook.ok).toBe(true)
      fixture.harness.publisher.clear()
    }
    const before = fixture.harness.store.snapshot()
    const result = await useCase(fixture.harness).execute(
      amendmentCommand(
        fixture.originalId,
        {
          type: "EXPENSE",
          accountId: fixture.account.id,
          categoryId: fixture.category.id,
          amountMinor: "3000",
          currency: "BRL",
          occurredOn: "2026-08-06",
          description: "Rejected",
        },
        overrides as Partial<{ bookId: string; expectedVersion: number }>
      )
    )

    expect(result).toMatchObject({ ok: false, error: { code } })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it.each([
    ["missing account", { accountId: "missing" }, "ENTITY_NOT_FOUND"],
    ["missing category", { categoryId: "missing" }, "ENTITY_NOT_FOUND"],
    ["zero amount", { amountMinor: "0" }, "NON_POSITIVE_AMOUNT"],
    ["negative amount", { amountMinor: "-1" }, "NON_POSITIVE_AMOUNT"],
    ["currency mismatch", { currency: "USD" }, "CURRENCY_MISMATCH"],
    ["invalid date", { occurredOn: "2026-02-30" }, "INVALID_DATE"],
    [
      "empty description",
      { description: "   " },
      "INVALID_JOURNAL_DESCRIPTION",
    ],
  ] as const)(
    "rejects %s before persistence",
    async (_label, replacement, code) => {
      const fixture = await prepared()
      const before = fixture.harness.store.snapshot()
      const result = await useCase(fixture.harness).execute(
        amendmentCommand(fixture.originalId, {
          type: "EXPENSE",
          accountId: fixture.account.id,
          categoryId: fixture.category.id,
          amountMinor: "3000",
          currency: "BRL",
          occurredOn: "2026-08-06",
          description: "Valid description",
          ...replacement,
        })
      )

      expect(result).toMatchObject({ ok: false, error: { code } })
      expect(fixture.harness.store.snapshot()).toEqual(before)
      expect(fixture.harness.publisher.events).toEqual([])
    }
  )

  it("rejects an archived replacement account and category", async () => {
    const fixture = await prepared()
    const account = fixture.harness.store.getAccount(
      fixture.destination.id as never
    )
    const category = fixture.harness.store.getAccount(
      fixture.category.id as never
    )
    fixture.harness.store.putAccount({
      ...account!,
      status: "ARCHIVED",
      version: account!.version + 1,
    })
    fixture.harness.store.putAccount({
      ...category!,
      status: "ARCHIVED",
      version: category!.version + 1,
    })
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: fixture.destination.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-06",
        description: "Rejected",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACCOUNT_STATUS" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects a same-account transfer and keeps the store unchanged", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "TRANSFER",
        sourceAccountId: fixture.account.id,
        destinationAccountId: fixture.account.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-06",
        description: "Rejected",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SAME_TRANSFER_ACCOUNT" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
  })

  it("rejects a replacement account from another book", async () => {
    const fixture = await prepared()
    const otherBook = await new (
      await import("@workspace/application")
    ).CreateFinancialBook(
      fixture.harness.transactionManager,
      fixture.harness.dispatcher,
      fixture.harness.ids
    ).execute({ name: "Other", baseCurrency: "BRL", timezone: "UTC" })
    expect(otherBook.ok).toBe(true)
    const otherAccount = await new CreateFinancialAccount(
      fixture.harness.transactionManager,
      fixture.harness.dispatcher,
      fixture.harness.ids
    ).execute({ bookId: "book-2", name: "Other cash", kind: "ASSET" })
    expect(otherAccount.ok).toBe(true)
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: otherAccount.ok ? otherAccount.value.id : "missing",
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-06",
        description: "Rejected",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
  })

  it("rolls back both entries, links, sequence and facts when persistence fails", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(
      fixture.harness,
      conflictTransactionManager(fixture.harness.transactionManager)
    ).execute(
      amendmentCommand(fixture.originalId, {
        type: "EXPENSE",
        accountId: fixture.account.id,
        categoryId: fixture.category.id,
        amountMinor: "3000",
        currency: "BRL",
        occurredOn: "2026-08-06",
        description: "Rejected",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })
})
