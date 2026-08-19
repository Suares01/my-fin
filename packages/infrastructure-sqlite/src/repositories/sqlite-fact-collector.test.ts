import type { DomainFact } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { SqliteFactCollector } from "./sqlite-fact-collector.js"

function fact(type: string, aggregateId: string): DomainFact {
  return {
    type,
    aggregateId,
    aggregateVersion: 0,
    payload: { aggregateId },
  }
}

describe("SqliteFactCollector", () => {
  it("preserves the order of recorded facts", () => {
    const collector = new SqliteFactCollector()
    const first = fact("FinancialBookCreated", "book-1")
    const second = fact("LedgerAccountCreated", "account-1")

    collector.record([first, second])

    expect(collector.pull()).toEqual([first, second])
  })

  it("accepts empty batches without creating facts", () => {
    const collector = new SqliteFactCollector()

    collector.record([])

    expect(collector.pull()).toEqual([])
  })

  it("returns the current facts once and empties the collector", () => {
    const collector = new SqliteFactCollector()
    const recorded = fact("JournalEntryPosted", "entry-1")

    collector.record([recorded])

    expect(collector.pull()).toEqual([recorded])
    expect(collector.pull()).toEqual([])
  })

  it("copies the caller batch before recording it", () => {
    const collector = new SqliteFactCollector()
    const recorded = fact("FinancialBookCreated", "book-1")
    const batch: DomainFact[] = [recorded]

    collector.record(batch)
    batch.length = 0

    expect(collector.pull()).toEqual([recorded])
  })

  it("detaches a pulled batch from the collector state", () => {
    const collector = new SqliteFactCollector()
    const recorded = fact("LedgerAccountCreated", "account-1")

    collector.record([recorded])
    const pulled = collector.pull() as DomainFact[]
    pulled.length = 0

    collector.record([recorded])
    expect(collector.pull()).toEqual([recorded])
  })
})
