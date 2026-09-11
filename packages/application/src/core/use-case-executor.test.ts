import { DomainError, Result } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { DomainEventDispatcher } from "./event-dispatcher.js"
import { executeUseCase, toApplicationError } from "./use-case-executor.js"
import type {
  DomainEventEnvelope,
  DomainEventPublisher,
} from "../ports/events.js"
import type { TransactionManager } from "../ports/transaction.js"
import type { Clock, IdGenerator } from "../ports/time.js"

const facts = [
  {
    type: "FinancialBookCreated",
    aggregateId: "book-1",
    aggregateVersion: 0,
    payload: { id: "book-1", name: "Main" },
  },
  {
    type: "LedgerAccountCreated",
    aggregateId: "account-1",
    aggregateVersion: 0,
    payload: { id: "account-1", bookId: "book-1", kind: "ASSET" },
  },
] as const

class FixedClock implements Clock {
  now(): string {
    return "2026-08-04T12:00:00.000Z"
  }

  localDate(): string {
    return "2026-08-04"
  }
}

class FixedIds implements IdGenerator {
  private eventIndex = 0

  nextBookId() {
    return "book-generated" as never
  }

  nextLedgerAccountId() {
    return "account-generated" as never
  }

  nextJournalEntryId() {
    return "entry-generated" as never
  }

  nextPostingId() {
    return "posting-generated" as never
  }

  nextInvestmentInstrumentId() {
    return "instrument-generated" as never
  }

  nextInvestmentPositionId() {
    return "position-generated" as never
  }

  nextInvestmentOperationId() {
    return "operation-generated" as never
  }

  nextInvestmentValuationId() {
    return "valuation-generated" as never
  }

  nextEventId(): string {
    this.eventIndex += 1
    return `event-${this.eventIndex}`
  }
}

class Collector implements DomainEventPublisher {
  readonly events: DomainEventEnvelope[] = []

  publish(event: DomainEventEnvelope): void {
    this.events.push(event)
  }
}

function dispatcher(publisher: Collector): DomainEventDispatcher {
  return new DomainEventDispatcher(new FixedClock(), new FixedIds(), publisher)
}

describe("DomainEventDispatcher", () => {
  it("versions every supported event from its immutable fact version", async () => {
    const publisher = new Collector()
    const allFacts = [
      {
        type: "FinancialBookCreated",
        aggregateId: "book-1",
        aggregateVersion: 0,
        payload: { bookId: "book-1" },
      },
      {
        type: "LedgerAccountCreated",
        aggregateId: "account-1",
        aggregateVersion: 0,
        payload: { bookId: "book-1" },
      },
      {
        type: "JournalEntryPosted",
        aggregateId: "entry-1",
        aggregateVersion: 2,
        payload: { bookId: "book-1" },
      },
      {
        type: "JournalEntryReversed",
        aggregateId: "entry-1",
        aggregateVersion: 3,
        payload: { bookId: "book-1" },
      },
    ] as const

    await dispatcher(publisher).dispatch(allFacts)

    expect(
      publisher.events.map(({ type, eventVersion, aggregateVersion }) => ({
        type,
        eventVersion,
        aggregateVersion,
      }))
    ).toEqual([
      { type: "FinancialBookCreated", eventVersion: 1, aggregateVersion: 0 },
      { type: "LedgerAccountCreated", eventVersion: 1, aggregateVersion: 0 },
      { type: "JournalEntryPosted", eventVersion: 1, aggregateVersion: 2 },
      { type: "JournalEntryReversed", eventVersion: 1, aggregateVersion: 3 },
    ])
  })

  it("publishes every ledger account lifecycle fact with its exact envelope values", async () => {
    const publisher = new Collector()

    await dispatcher(publisher).dispatch([
      {
        type: "LedgerAccountArchived",
        aggregateId: "account-1",
        aggregateVersion: 1,
        payload: {
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira Principal",
          normalizedName: "carteira principal",
          status: "ARCHIVED",
        },
      },
      {
        type: "LedgerAccountRenamed",
        aggregateId: "account-1",
        aggregateVersion: 2,
        payload: {
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira de Reserva",
          normalizedName: "carteira de reserva",
          status: "ACTIVE",
        },
      },
      {
        type: "LedgerAccountReactivated",
        aggregateId: "account-1",
        aggregateVersion: 3,
        payload: {
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira de Reserva",
          normalizedName: "carteira de reserva",
          status: "ACTIVE",
        },
      },
    ])

    expect(
      publisher.events.map(({ type, aggregateVersion, bookId, payload }) => ({
        type,
        aggregateVersion,
        bookId,
        payload,
      }))
    ).toEqual([
      {
        type: "LedgerAccountArchived",
        aggregateVersion: 1,
        bookId: "book-1",
        payload: {
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira Principal",
          normalizedName: "carteira principal",
          status: "ARCHIVED",
        },
      },
      {
        type: "LedgerAccountRenamed",
        aggregateVersion: 2,
        bookId: "book-1",
        payload: {
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira de Reserva",
          normalizedName: "carteira de reserva",
          status: "ACTIVE",
        },
      },
      {
        type: "LedgerAccountReactivated",
        aggregateVersion: 3,
        bookId: "book-1",
        payload: {
          bookId: "book-1",
          kind: "ASSET",
          name: "Carteira de Reserva",
          normalizedName: "carteira de reserva",
          status: "ACTIVE",
        },
      },
    ])
  })

  it("publishes CategoryUpdated with the resulting appearance snapshot", async () => {
    const publisher = new Collector()

    await dispatcher(publisher).dispatch([
      {
        type: "CategoryUpdated",
        aggregateId: "category-1",
        aggregateVersion: 3,
        payload: {
          bookId: "book-1",
          kind: "EXPENSE",
          name: "Dining",
          normalizedName: "dining",
          status: "ACTIVE",
          iconKey: "restaurant",
          colorHex: "abcdef",
        },
      },
    ])

    expect(publisher.events).toEqual([
      {
        eventId: "event-1",
        type: "CategoryUpdated",
        eventVersion: 1,
        occurredAt: "2026-08-04T12:00:00.000Z",
        aggregateId: "category-1",
        aggregateVersion: 3,
        bookId: "book-1",
        payload: {
          bookId: "book-1",
          kind: "EXPENSE",
          name: "Dining",
          normalizedName: "dining",
          status: "ACTIVE",
          iconKey: "restaurant",
          colorHex: "abcdef",
        },
      },
    ])
  })

  it("rejects an unknown event type without publishing it", async () => {
    const publisher = new Collector()

    await expect(
      dispatcher(publisher).dispatch([
        {
          type: "UnknownEvent",
          aggregateId: "category-1",
          aggregateVersion: 1,
          payload: { bookId: "book-1" },
        },
      ])
    ).rejects.toMatchObject({
      code: "UNEXPECTED_ERROR",
      message: "Unsupported domain event type: UnknownEvent",
    })
    expect(publisher.events).toEqual([])
  })

  it("creates deterministic envelopes in fact order with exact identity and payload", async () => {
    const publisher = new Collector()

    await dispatcher(publisher).dispatch(facts)

    expect(publisher.events).toEqual([
      {
        eventId: "event-1",
        type: "FinancialBookCreated",
        eventVersion: 1,
        occurredAt: "2026-08-04T12:00:00.000Z",
        aggregateId: "book-1",
        aggregateVersion: 0,
        bookId: "book-1",
        payload: { id: "book-1", name: "Main" },
      },
      {
        eventId: "event-2",
        type: "LedgerAccountCreated",
        eventVersion: 1,
        occurredAt: "2026-08-04T12:00:00.000Z",
        aggregateId: "account-1",
        aggregateVersion: 0,
        bookId: "book-1",
        payload: { id: "account-1", bookId: "book-1", kind: "ASSET" },
      },
    ])
  })

  it("publishes facts sequentially and waits for each publisher call", async () => {
    const order: string[] = []
    const publisher: DomainEventPublisher = {
      async publish(event) {
        order.push(`publish:${event.eventId}`)
        await Promise.resolve()
        order.push(`done:${event.eventId}`)
      },
    }

    await new DomainEventDispatcher(
      new FixedClock(),
      new FixedIds(),
      publisher
    ).dispatch(facts)

    expect(order).toEqual([
      "publish:event-1",
      "done:event-1",
      "publish:event-2",
      "done:event-2",
    ])
  })
})

describe("executeUseCase", () => {
  it("publishes only after the transaction returns a committed value", async () => {
    const order: string[] = []
    const transactionManager: TransactionManager = {
      async execute<T>() {
        order.push("commit")
        return { value: "created" as T, facts }
      },
    }
    const publisher: DomainEventPublisher = {
      publish(event) {
        order.push(`publish:${event.eventId}`)
      },
    }

    const result = await executeUseCase({
      transactionManager,
      eventDispatcher: new DomainEventDispatcher(
        new FixedClock(),
        new FixedIds(),
        publisher
      ),
      work: async () => "created",
    })

    expect(result).toEqual(Result.ok("created"))
    expect(order).toEqual(["commit", "publish:event-1", "publish:event-2"])
  })

  it("publishes zero events when the transaction fails", async () => {
    const publisher = new Collector()
    const transactionManager: TransactionManager = {
      async execute() {
        throw new DomainError("ENTITY_NOT_FOUND", "Book was not found")
      },
    }

    const result = await executeUseCase({
      transactionManager,
      eventDispatcher: dispatcher(publisher),
      work: async () => "never",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("ENTITY_NOT_FOUND")
      expect(result.error.message).toBe("Book was not found")
    }
    expect(publisher.events).toEqual([])
  })

  it("maps unexpected errors to a stable public error", async () => {
    const result = await executeUseCase({
      transactionManager: {
        async execute() {
          throw new Error("database exploded")
        },
      },
      eventDispatcher: dispatcher(new Collector()),
      work: async () => "never",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("database exploded")
    }
  })

  it("preserves an existing application error code", () => {
    const error = toApplicationError(
      new DomainError("DUPLICATE_ENTITY", "Already exists")
    )

    expect(error.code).toBe("DUPLICATE_ENTITY")
    expect(error.message).toBe("Already exists")
  })

  it("returns the successful transaction value when no facts exist", async () => {
    const publisher = new Collector()
    const result = await executeUseCase({
      transactionManager: {
        async execute<T>() {
          return { value: 42 as T, facts: [] }
        },
      },
      eventDispatcher: dispatcher(publisher),
      work: async () => 42,
    })

    expect(result).toEqual(Result.ok(42))
    expect(publisher.events).toEqual([])
  })

  it("produces equal envelopes for equivalent fixed dependencies", async () => {
    const first = new Collector()
    const second = new Collector()
    await dispatcher(first).dispatch(facts)
    await dispatcher(second).dispatch(facts)

    expect(first.events).toEqual(second.events)
    expect(first.events[0]?.occurredAt).toBe("2026-08-04T12:00:00.000Z")
    expect(first.events[1]?.eventId).toBe("event-2")
  })
})
