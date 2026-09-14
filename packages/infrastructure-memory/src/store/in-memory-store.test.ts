import { describe, expect, it } from "vitest"
import type {
  FinancialBookSnapshot,
  InvestmentInstrumentSnapshot,
  InvestmentOperationSnapshot,
  InvestmentPositionSnapshot,
  InvestmentValuationSnapshot,
  JournalEntrySnapshot,
} from "@workspace/domain"
import type { InvestmentRequestReceipt } from "@workspace/application"
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

const instrument = {
  id: "instrument-1",
  bookId: "book-1",
  identifiers: [{ scheme: "TICKER", value: "ABC", market: "B3" }],
} as unknown as InvestmentInstrumentSnapshot
const position = {
  id: "position-1",
  bookId: "book-1",
  fixedIncomeTerms: { rateKind: "PREFIXED", annualRate: "10" },
} as unknown as InvestmentPositionSnapshot
const operation = {
  id: "operation-1",
  bookId: "book-1",
  categories: { feeCategoryId: "fee-1" },
  positionBefore: {
    kind: "EXISTING",
    bookCostMinor: "100",
    status: "OPEN",
    openedOn: "2026-01-01",
    allocationEffectiveOn: "2026-01-01",
  },
} as unknown as InvestmentOperationSnapshot
const valuation = {
  id: "valuation-1",
  bookId: "book-1",
  grossValueMinor: "100",
} as unknown as InvestmentValuationSnapshot
const receipt = {
  bookId: "book-1",
  requestId: "request-1",
  result: {
    requestId: "request-1",
    journalEntryIds: ["entry-1"],
    warnings: [
      {
        code: "INVESTMENT_CASH_NEGATIVE",
        investmentAccountId: "account-1",
        cashMinor: "-1",
        currency: "BRL",
        asOf: "2026-01-01",
      },
    ],
  },
} as unknown as InvestmentRequestReceipt

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
      investmentInstruments: [],
      investmentPositions: [],
      investmentOperations: [],
      investmentValuations: [],
      investmentRequests: [],
      investmentSequences: [],
    })

    expect(store.snapshot()).toEqual({
      books: [],
      accounts: [],
      journalEntries: [],
      journalSequences: [],
      investmentInstruments: [],
      investmentPositions: [],
      investmentOperations: [],
      investmentValuations: [],
      investmentRequests: [],
      investmentSequences: [],
    })
  })

  it("copies instrument identifiers in snapshots", () => {
    const store = new InMemoryStore()
    store.putInvestmentInstrument(instrument)
    const snapshot = store.snapshot()
    Object.assign(
      snapshot.investmentInstruments[0]!.identifiers[0] as { value: string },
      { value: "MUTATED" }
    )
    expect(
      store.getInvestmentInstrument(instrument.id)?.identifiers[0]?.value
    ).toBe("ABC")
  })
  it("copies fixed-income terms in snapshots", () => {
    const store = new InMemoryStore()
    store.putInvestmentPosition(position)
    const snapshot = store.snapshot()
    Object.assign(
      snapshot.investmentPositions[0]!.fixedIncomeTerms as {
        annualRate: string
      },
      { annualRate: "99" }
    )
    expect(
      store.getInvestmentPosition(position.id)?.fixedIncomeTerms?.annualRate
    ).toBe("10")
  })
  it("copies operation categories in snapshots", () => {
    const store = new InMemoryStore()
    store.putInvestmentOperation(operation)
    const snapshot = store.snapshot()
    Object.assign(
      snapshot.investmentOperations[0]!.categories as { feeCategoryId: string },
      { feeCategoryId: "changed" }
    )
    expect(
      store.getInvestmentOperation(operation.id)?.categories.feeCategoryId
    ).toBe("fee-1")
  })
  it("copies operation state-before in snapshots", () => {
    const store = new InMemoryStore()
    store.putInvestmentOperation(operation)
    const snapshot = store.snapshot()
    Object.assign(
      snapshot.investmentOperations[0]!.positionBefore as {
        bookCostMinor: string
      },
      { bookCostMinor: "999" }
    )
    expect(
      (
        store.getInvestmentOperation(operation.id)?.positionBefore as {
          bookCostMinor: string
        }
      ).bookCostMinor
    ).toBe("100")
  })
  it("keeps valuations in the snapshot", () => {
    const store = new InMemoryStore()
    store.putInvestmentValuation(valuation)
    expect(store.snapshot().investmentValuations).toEqual([valuation])
  })
  it("copies receipt results and warnings", () => {
    const store = new InMemoryStore()
    store.putInvestmentRequest(receipt)
    const result = store.getInvestmentRequest(
      receipt.bookId as never,
      receipt.requestId
    )!
    Object.assign(result.result.warnings[0] as { cashMinor: string }, {
      cashMinor: "0",
    })
    expect(
      store.getInvestmentRequest(receipt.bookId as never, receipt.requestId)
        ?.result.warnings[0]?.cashMinor
    ).toBe("-1")
  })
  it("isolates receipts by book and request id", () => {
    const store = new InMemoryStore()
    store.putInvestmentRequest(receipt)
    expect(
      store.getInvestmentRequest("other-book" as never, receipt.requestId)
    ).toBeUndefined()
  })
  it("reserves independent exact investment sequences per book", () => {
    const store = new InMemoryStore()
    expect(store.reserveNextInvestmentSequence("book-1" as never)).toBe("1")
    expect(store.reserveNextInvestmentSequence("book-2" as never)).toBe("1")
  })
  it("restores investment collections and sequences", () => {
    const store = new InMemoryStore()
    store.putInvestmentInstrument(instrument)
    store.putInvestmentPosition(position)
    store.putInvestmentOperation(operation)
    store.putInvestmentValuation(valuation)
    store.putInvestmentRequest(receipt)
    store.reserveNextInvestmentSequence("book-1" as never)
    const snapshot = store.snapshot()
    store.putInvestmentInstrument({ ...instrument, id: "other" as never })
    store.restore(snapshot)
    expect(store.snapshot()).toEqual(snapshot)
  })
  it("restores investment state after a replacement", () => {
    const store = new InMemoryStore()
    store.putInvestmentInstrument(instrument)
    const before = store.snapshot()
    store.putInvestmentInstrument({ ...instrument, identifiers: [] })
    store.restore(before)
    expect(store.getInvestmentInstrument(instrument.id)?.identifiers).toEqual(
      instrument.identifiers
    )
  })
})
