import { describe, expect, it } from "vitest"
import type {
  FinancialBookSnapshot,
  JournalEntrySnapshot,
} from "@workspace/domain"
import { InMemoryStore } from "./in-memory-store.js"

const book: FinancialBookSnapshot = {
  id: "book-1" as never,
  name: "Main",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
  version: 0,
}

const journalEntry: JournalEntrySnapshot = {
  id: "entry-1" as never,
  bookId: "book-1" as never,
  occurredOn: "2026-08-04",
  recordedAt: "2026-08-04T12:00:00.000Z",
  sequence: "1",
  description: "Opening",
  currency: "BRL",
  origin: "SYSTEM",
  postings: [
    {
      id: "posting-1" as never,
      accountId: "account-1" as never,
      amountMinor: 100n,
      currency: "BRL",
    },
    {
      id: "posting-2" as never,
      accountId: "account-2" as never,
      amountMinor: -100n,
      currency: "BRL",
    },
  ],
  version: 0,
}

describe("InMemoryStore", () => {
  it("returns a copy when reading a stored book", () => {
    const store = new InMemoryStore()
    store.putBook(book)

    const external = store.getBook(book.id)
    expect(external).toEqual(book)
    if (external) {
      Object.assign(external as { name: string }, { name: "Changed" })
    }

    expect(store.getBook(book.id)?.name).toBe("Main")
  })

  it("copies nested postings in reads", () => {
    const store = new InMemoryStore()
    store.putJournalEntry(journalEntry)

    const external = store.getJournalEntry(journalEntry.id)
    expect(external?.postings[0]?.amountMinor).toBe(100n)
    if (external) {
      Object.assign(external.postings[0] as { amountMinor: bigint }, {
        amountMinor: 999n,
      })
    }

    expect(
      store.getJournalEntry(journalEntry.id)?.postings[0]?.amountMinor
    ).toBe(100n)
  })

  it("copies every collection in a store snapshot", () => {
    const store = new InMemoryStore()
    store.putBook(book)
    store.putJournalEntry(journalEntry)

    const snapshot = store.snapshot()
    Object.assign(snapshot.books[0] as { name: string }, {
      name: "Mutated snapshot",
    })
    Object.assign(
      snapshot.journalEntries[0]!.postings[0] as { amountMinor: bigint },
      {
        amountMinor: 321n,
      }
    )

    expect(store.getBook(book.id)?.name).toBe("Main")
    expect(
      store.getJournalEntry(journalEntry.id)?.postings[0]?.amountMinor
    ).toBe(100n)
  })

  it("restores all collections from an isolated snapshot", () => {
    const store = new InMemoryStore()
    store.putBook(book)
    store.putJournalEntry(journalEntry)
    const snapshot = store.snapshot()
    store.putBook({ ...book, name: "Changed" })

    store.restore(snapshot)

    expect(store.snapshot()).toEqual(snapshot)
    expect(store.getBook(book.id)?.name).toBe("Main")
  })

  it("restoring an empty snapshot removes all stored aggregates", () => {
    const store = new InMemoryStore()
    store.putBook(book)
    store.putJournalEntry(journalEntry)

    store.restore({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
    })

    expect(store.snapshot()).toEqual({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
    })
  })
})
