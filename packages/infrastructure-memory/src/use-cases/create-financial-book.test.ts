import {
  CreateFinancialBook,
  DomainEventDispatcher,
} from "@workspace/application"
import { Result } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import {
  CollectingDomainEventPublisher,
  FixedClock,
  InMemoryStore,
  InMemoryTransactionManager,
  SequentialIdGenerator,
} from "../index.js"

function harness() {
  const store = new InMemoryStore()
  const ids = new SequentialIdGenerator()
  const publisher = new CollectingDomainEventPublisher()
  const transactionManager = new InMemoryTransactionManager(store)
  const dispatcher = new DomainEventDispatcher(
    new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
    ids,
    publisher
  )

  return {
    store,
    ids,
    publisher,
    transactionManager,
    useCase: new CreateFinancialBook(transactionManager, dispatcher, ids),
  }
}

const validCommand = {
  name: "  Personal book  ",
  baseCurrency: "BRL",
  timezone: "  America/Sao_Paulo  ",
}

describe("CreateFinancialBook", () => {
  it("creates the book and the four exact system account purposes and kinds", async () => {
    const { store, useCase } = harness()

    const result = await useCase.execute(validCommand)

    expect(result).toEqual(
      Result.ok({
        id: "book-1",
        name: "Personal book",
        baseCurrency: "BRL",
        timezone: "America/Sao_Paulo",
        version: 0,
      })
    )
    expect(store.listBooks()).toEqual([
      {
        id: "book-1",
        name: "Personal book",
        baseCurrency: "BRL",
        timezone: "America/Sao_Paulo",
        version: 0,
      },
    ])
    expect(
      store
        .listAccounts()
        .map(({ systemPurpose, kind }) => ({ systemPurpose, kind }))
    ).toEqual([
      { systemPurpose: "OPENING_BALANCE", kind: "EQUITY" },
      { systemPurpose: "RECONCILIATION_ADJUSTMENT", kind: "EQUITY" },
      { systemPurpose: "UNCATEGORIZED_INCOME", kind: "INCOME" },
      { systemPurpose: "UNCATEGORIZED_EXPENSE", kind: "EXPENSE" },
    ])
  })

  it("normalizes the book name and timezone in the serializable output", async () => {
    const { useCase } = harness()

    const result = await useCase.execute(validCommand)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe("Personal book")
      expect(result.value.timezone).toBe("America/Sao_Paulo")
      expect(typeof result.value.id).toBe("string")
      expect(typeof result.value.version).toBe("number")
    }
  })

  it("publishes one book event followed by four account events after commit", async () => {
    const { publisher, useCase } = harness()

    const result = await useCase.execute(validCommand)

    expect(result.ok).toBe(true)
    expect(publisher.events.map(({ type }) => type)).toEqual([
      "FinancialBookCreated",
      "LedgerAccountCreated",
      "LedgerAccountCreated",
      "LedgerAccountCreated",
      "LedgerAccountCreated",
    ])
    expect(
      publisher.events.map(({ eventId, aggregateId, bookId }) => ({
        eventId,
        aggregateId,
        bookId,
      }))
    ).toEqual([
      { eventId: "event-1", aggregateId: "book-1", bookId: "book-1" },
      { eventId: "event-2", aggregateId: "account-1", bookId: "book-1" },
      { eventId: "event-3", aggregateId: "account-2", bookId: "book-1" },
      { eventId: "event-4", aggregateId: "account-3", bookId: "book-1" },
      { eventId: "event-5", aggregateId: "account-4", bookId: "book-1" },
    ])
  })

  it("publishes event payloads with the exact book and account values", async () => {
    const { publisher, useCase } = harness()

    await useCase.execute(validCommand)

    expect(publisher.events[0]?.payload).toEqual({
      id: "book-1",
      name: "Personal book",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      version: 0,
    })
    expect(publisher.events.slice(1).map(({ payload }) => payload)).toEqual([
      expect.objectContaining({
        id: "account-1",
        bookId: "book-1",
        kind: "EQUITY",
        systemPurpose: "OPENING_BALANCE",
        version: 0,
      }),
      expect.objectContaining({
        id: "account-2",
        bookId: "book-1",
        kind: "EQUITY",
        systemPurpose: "RECONCILIATION_ADJUSTMENT",
        version: 0,
      }),
      expect.objectContaining({
        id: "account-3",
        bookId: "book-1",
        kind: "INCOME",
        systemPurpose: "UNCATEGORIZED_INCOME",
        version: 0,
      }),
      expect.objectContaining({
        id: "account-4",
        bookId: "book-1",
        kind: "EXPENSE",
        systemPurpose: "UNCATEGORIZED_EXPENSE",
        version: 0,
      }),
    ])
  })

  it("rejects an empty name without persisting aggregates or events", async () => {
    const { store, publisher, useCase } = harness()

    const result = await useCase.execute({ ...validCommand, name: "   " })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_BOOK_NAME" },
    })
    expect(store.snapshot()).toEqual({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
    })
    expect(publisher.events).toEqual([])
  })

  it("rejects an empty timezone without persisting aggregates or events", async () => {
    const { store, publisher, useCase } = harness()

    const result = await useCase.execute({ ...validCommand, timezone: "   " })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TIMEZONE" },
    })
    expect(store.snapshot()).toEqual({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
    })
    expect(publisher.events).toEqual([])
  })

  it("rejects an invalid base currency without persisting aggregates or events", async () => {
    const { store, publisher, useCase } = harness()

    const result = await useCase.execute({
      ...validCommand,
      baseCurrency: "brl",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_CURRENCY" },
    })
    expect(store.snapshot()).toEqual({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
    })
    expect(publisher.events).toEqual([])
  })

  it("rolls back the book and accounts after an intermediate repository failure", async () => {
    const { store, publisher, transactionManager, ids } = harness()
    const failingManager = {
      async execute<T>(
        work: Parameters<typeof transactionManager.execute<T>>[0]
      ) {
        return transactionManager.execute(async (repositories) =>
          work({
            ...repositories,
            accounts: {
              ...repositories.accounts,
              async add(account) {
                await repositories.accounts.add(account)
                throw new Error("forced account failure")
              },
            },
          })
        )
      },
    }
    const useCase = new CreateFinancialBook(
      failingManager,
      new DomainEventDispatcher(
        new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04"),
        ids,
        publisher
      ),
      ids
    )

    const result = await useCase.execute(validCommand)

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNEXPECTED_ERROR", message: "forced account failure" },
    })
    expect(store.snapshot()).toEqual({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
    })
    expect(publisher.events).toEqual([])
  })

  it("does not publish events when the transaction rejects before commit", async () => {
    const { publisher, useCase } = harness()

    const result = await useCase.execute({
      ...validCommand,
      baseCurrency: "BR",
    })

    expect(result.ok).toBe(false)
    expect(publisher.events).toHaveLength(0)
  })

  it("keeps equivalent fixed executions deterministic", async () => {
    const first = harness()
    const second = harness()

    const firstResult = await first.useCase.execute(validCommand)
    const secondResult = await second.useCase.execute(validCommand)

    expect(firstResult).toEqual(secondResult)
    expect(first.store.snapshot()).toEqual(second.store.snapshot())
    expect(first.publisher.events).toEqual(second.publisher.events)
  })
})
