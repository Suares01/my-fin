import type { DomainEventEnvelope } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  CollectingDomainEventPublisher,
  FixedClock,
  SequentialIdGenerator,
} from "./index.js"

const event = (eventId: string): DomainEventEnvelope => ({
  eventId,
  type: "LedgerAccountCreated",
  eventVersion: 1,
  occurredAt: "2026-08-04T12:00:00.000Z",
  aggregateId: "account-1",
  aggregateVersion: 0,
  bookId: "book-1",
  payload: { id: "account-1", kind: "ASSET" },
})

describe("deterministic memory adapters", () => {
  it("returns the configured instant and local date", () => {
    const clock = new FixedClock("2026-08-04T12:00:00.000Z", "2026-08-04")

    expect(clock.now()).toBe("2026-08-04T12:00:00.000Z")
    expect(clock.localDate("America/Sao_Paulo")).toBe("2026-08-04")
    expect(clock.localDate("UTC")).toBe("2026-08-04")
  })

  it("generates predictable IDs with independent sequences per type", () => {
    const ids = new SequentialIdGenerator()

    expect(ids.nextBookId()).toBe("book-1")
    expect(ids.nextBookId()).toBe("book-2")
    expect(ids.nextLedgerAccountId()).toBe("account-1")
    expect(ids.nextJournalEntryId()).toBe("entry-1")
    expect(ids.nextPostingId()).toBe("posting-1")
    expect(ids.nextEventId()).toBe("event-1")
  })

  it("does not share counters between generator instances", () => {
    const first = new SequentialIdGenerator()
    const second = new SequentialIdGenerator()

    expect(first.nextEventId()).toBe("event-1")
    expect(first.nextEventId()).toBe("event-2")
    expect(second.nextEventId()).toBe("event-1")
  })

  it("collects complete envelopes in publication order", () => {
    const publisher = new CollectingDomainEventPublisher()
    const first = event("event-1")
    const second = event("event-2")

    publisher.publish(first)
    publisher.publish(second)

    expect(publisher.events).toEqual([first, second])
    expect(publisher.events[0]?.payload).toEqual({
      id: "account-1",
      kind: "ASSET",
    })
    publisher.clear()
    expect(publisher.events).toEqual([])
  })

  it("reproduces IDs and published envelopes for equivalent executions", () => {
    const firstIds = new SequentialIdGenerator()
    const secondIds = new SequentialIdGenerator()
    const firstPublisher = new CollectingDomainEventPublisher()
    const secondPublisher = new CollectingDomainEventPublisher()

    for (let index = 0; index < 2; index += 1) {
      firstPublisher.publish(event(firstIds.nextEventId()))
      secondPublisher.publish(event(secondIds.nextEventId()))
    }

    expect(firstPublisher.events).toEqual(secondPublisher.events)
    expect(firstPublisher.events.map((item) => item.eventId)).toEqual([
      "event-1",
      "event-2",
    ])
  })

  it("keeps event IDs distinct from aggregate IDs", () => {
    const ids = new SequentialIdGenerator()

    expect(ids.nextEventId()).not.toBe(ids.nextJournalEntryId())
    expect(ids.nextEventId()).not.toBe(ids.nextLedgerAccountId())
  })
})
