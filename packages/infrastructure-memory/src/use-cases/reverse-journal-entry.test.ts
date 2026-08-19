import {
  ApplicationError,
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
} from "./test-helpers.js"

function useCase(
  harness: ReturnType<typeof createHarness>,
  transactionManager: TransactionManager = harness.transactionManager
) {
  return new ReverseJournalEntry(
    transactionManager,
    harness.dispatcher,
    harness.ids,
    harness.clock
  )
}

function command(
  overrides: Partial<{
    bookId: string
    journalEntryId: string
    expectedVersion: number
    occurredOn: string
    description: string
  }> = {}
) {
  return {
    bookId: "book-1",
    journalEntryId: "entry-1",
    expectedVersion: 0,
    occurredOn: "2026-08-05",
    description: "Reverse lunch",
    ...overrides,
  }
}

async function prepared() {
  const harness = createHarness()
  await createBook(harness)
  await createFinancialAccount(harness)
  await createExpenseCategory(harness)
  const expenseResult = await new RecordExpense(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids,
    harness.clock
  ).execute({
    bookId: "book-1",
    accountId: "account-5",
    categoryId: "account-6",
    amountMinor: "2500",
    currency: "BRL",
    occurredOn: "2026-08-04",
    description: "Lunch",
  })
  if (!expenseResult.ok) {
    throw new Error(`Journal fixture failed: ${expenseResult.error.code}`)
  }
  harness.publisher.clear()
  return { harness, originalId: expenseResult.value.id }
}

function conflictTransactionManager(
  base: TransactionManager
): TransactionManager {
  return {
    execute<T>(work: (repositories: RepositoryContext) => Promise<T>) {
      return base.execute((repositories) => {
        const journalEntries = {
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
              "Journal entry version changed during reversal"
            )
          },
        }
        return work({ ...repositories, journalEntries })
      })
    },
  }
}

describe("ReverseJournalEntry", () => {
  it("creates the reversal with exact opposite postings and links both entries", async () => {
    const fixture = await prepared()
    const originalBefore = fixture.harness.store.getJournalEntry(
      fixture.originalId as never
    )

    const result = await useCase(fixture.harness).execute(command())

    expect(result).toEqual({
      ok: true,
      value: {
        id: "entry-2",
        bookId: "book-1",
        occurredOn: "2026-08-05",
        description: "Reverse lunch",
        currency: "BRL",
        version: 0,
      },
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-1" as never)
    ).toMatchObject({
      reversedBy: "entry-2",
      version: 1,
    })
    expect(
      fixture.harness.store.getJournalEntry("entry-2" as never)
    ).toMatchObject({
      reversalOf: "entry-1",
      postings: [
        {
          id: "posting-3",
          accountId: "account-6",
          amountMinor: -2500n,
          currency: "BRL",
        },
        {
          id: "posting-4",
          accountId: "account-5",
          amountMinor: 2500n,
          currency: "BRL",
        },
      ],
    })
    expect(originalBefore?.postings).toEqual(
      fixture.harness.store.getJournalEntry("entry-1" as never)?.postings
    )
  })

  it("publishes JournalEntryPosted before JournalEntryReversed after commit", async () => {
    const fixture = await prepared()

    const result = await useCase(fixture.harness).execute(command())

    expect(result.ok).toBe(true)
    expect(fixture.harness.publisher.events.map(({ type }) => type)).toEqual([
      "JournalEntryPosted",
      "JournalEntryReversed",
    ])
    expect(
      fixture.harness.publisher.events.map(
        ({ eventId, aggregateId, bookId }) => ({
          eventId,
          aggregateId,
          bookId,
        })
      )
    ).toEqual([
      { eventId: "event-9", aggregateId: "entry-2", bookId: "book-1" },
      { eventId: "event-10", aggregateId: "entry-1", bookId: "book-1" },
    ])
    expect(fixture.harness.publisher.events[1]?.payload).toEqual({
      bookId: "book-1",
      originalId: "entry-1",
      reversalId: "entry-2",
    })
    expect(() => JSON.stringify(fixture.harness.publisher.events)).not.toThrow()
  })

  it("keeps every original posting field unchanged after reversal", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.getJournalEntry(
      fixture.originalId as never
    )

    await useCase(fixture.harness).execute(command())

    const after = fixture.harness.store.getJournalEntry(
      fixture.originalId as never
    )
    expect(after?.postings).toEqual(before?.postings)
    expect(after?.occurredOn).toBe(before?.occurredOn)
    expect(after?.description).toBe(before?.description)
    expect(after?.currency).toBe(before?.currency)
  })

  it("rejects a second reversal without partial state or events", async () => {
    const fixture = await prepared()
    await useCase(fixture.harness).execute(command())
    fixture.harness.publisher.clear()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ expectedVersion: 1 })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "JOURNAL_ENTRY_ALREADY_REVERSED" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects reversing a reversal without partial state or events", async () => {
    const fixture = await prepared()
    await useCase(fixture.harness).execute(command())
    fixture.harness.publisher.clear()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({
        journalEntryId: "entry-2",
        expectedVersion: 0,
        occurredOn: "2026-08-06",
      })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "JOURNAL_ENTRY_REVERSAL_NOT_REVERSIBLE" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects a reversal before the original date without partial state or events", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ occurredOn: "2026-08-03" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "REVERSAL_DATE_BEFORE_ORIGINAL" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects a stale expected version without partial state or events", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ expectedVersion: 1 })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects an amended predecessor as a non-effective target", async () => {
    const fixture = await prepared()
    const original = fixture.harness.store.getJournalEntry("entry-1" as never)
    if (original === undefined) throw new Error("Missing fixture entry")
    fixture.harness.store.putJournalEntry({
      ...original,
      reversedBy: "entry-2" as never,
      replacedBy: "entry-3" as never,
      version: 1,
    })
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ expectedVersion: 1 })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "JOURNAL_ENTRY_ALREADY_REVERSED" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects a missing journal entry without state or events", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ journalEntryId: "missing" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects a missing book without state or events", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ bookId: "missing" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects an entry belonging to another book without state or events", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ bookId: "book-2" })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rejects an empty reversal description without state or events", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()

    const result = await useCase(fixture.harness).execute(
      command({ description: "   " })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_JOURNAL_DESCRIPTION" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })

  it("rolls back the reversal when saving the original hits an optimistic conflict", async () => {
    const fixture = await prepared()
    const before = fixture.harness.store.snapshot()
    const conflictManager = conflictTransactionManager(
      fixture.harness.transactionManager
    )

    const result = await useCase(fixture.harness, conflictManager).execute(
      command()
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(fixture.harness.store.snapshot()).toEqual(before)
    expect(fixture.harness.publisher.events).toEqual([])
  })
})
