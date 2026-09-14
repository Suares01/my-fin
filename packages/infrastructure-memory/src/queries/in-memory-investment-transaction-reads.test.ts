import type {
  BookId,
  JournalEntrySnapshot,
  LedgerAccountSnapshot,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryInvestmentTransactionReads } from "./in-memory-investment-transaction-reads.js"

const bookId = "book" as BookId

function prepared() {
  const store = new InMemoryStore()
  store.putBook({
    id: bookId,
    name: "Book",
    baseCurrency: "BRL",
    timezone: "UTC",
    version: 0,
  })
  return { store, reads: new InMemoryInvestmentTransactionReads(store) }
}

function account(
  id: string,
  input: Partial<LedgerAccountSnapshot> = {}
): LedgerAccountSnapshot {
  return {
    id: id as never,
    bookId,
    name: id,
    normalizedName: id,
    kind: "ASSET",
    status: "ACTIVE",
    version: 0,
    ...input,
  }
}

function entry(
  id: string,
  occurredOn: string,
  accountId: string,
  amountMinor: bigint
): JournalEntrySnapshot {
  return {
    id: id as never,
    bookId,
    occurredOn,
    recordedAt: "2026-01-01T00:00:00.000Z",
    sequence: id,
    description: id,
    currency: "BRL",
    origin: "MANUAL",
    postings: [
      {
        id: `${id}-a` as never,
        accountId: accountId as never,
        amountMinor,
        currency: "BRL",
      },
      {
        id: `${id}-b` as never,
        accountId: "other" as never,
        amountMinor: -amountMinor,
        currency: "BRL",
      },
    ],
    version: 0,
  }
}

describe("InMemoryInvestmentTransactionReads", () => {
  it("returns the exact current ledger balance", async () => {
    const { store, reads } = prepared()
    store.putJournalEntry(entry("1", "2026-01-01", "a", 9007199254740993n))
    await expect(
      reads.accountLedgerBalance("book", "a" as never)
    ).resolves.toBe("9007199254740993")
  })
  it("includes postings on the as-of date", async () => {
    const { store, reads } = prepared()
    store.putJournalEntry(entry("1", "2026-01-02", "a", 10n))
    await expect(
      reads.accountLedgerBalance("book", "a" as never, "2026-01-02")
    ).resolves.toBe("10")
  })
  it("excludes future postings", async () => {
    const { store, reads } = prepared()
    store.putJournalEntry(entry("1", "2026-01-03", "a", 10n))
    await expect(
      reads.accountLedgerBalance("book", "a" as never, "2026-01-02")
    ).resolves.toBe("0")
  })
  it("preserves signed postings", async () => {
    const { store, reads } = prepared()
    store.putJournalEntry(entry("1", "2026-01-01", "a", 10n))
    store.putJournalEntry(entry("2", "2026-01-01", "a", -13n))
    await expect(
      reads.accountLedgerBalance("book", "a" as never)
    ).resolves.toBe("-3")
  })
  it("keeps books isolated", async () => {
    const { store, reads } = prepared()
    store.putJournalEntry({
      ...entry("1", "2026-01-01", "a", 10n),
      bookId: "other" as never,
    })
    await expect(
      reads.accountLedgerBalance("book", "a" as never)
    ).resolves.toBe("0")
  })
  it("returns zero for an account without postings", async () => {
    const { reads } = prepared()
    await expect(
      reads.accountLedgerBalance("book", "a" as never)
    ).resolves.toBe("0")
  })
  it("recognizes an active investment settlement dependent", async () => {
    const { store, reads } = prepared()
    store.putAccount(
      account("investment", {
        financialAccount: {
          type: "INVESTMENT_ACCOUNT",
          investment: { defaultSettlementAccountId: "settlement" as never },
        },
      })
    )
    await expect(
      reads.hasActiveSettlementDependents("book", "settlement" as never)
    ).resolves.toBe(true)
  })
  it("ignores archived investment settlement dependents", async () => {
    const { store, reads } = prepared()
    store.putAccount(
      account("investment", {
        status: "ARCHIVED",
        financialAccount: {
          type: "INVESTMENT_ACCOUNT",
          investment: { defaultSettlementAccountId: "settlement" as never },
        },
      })
    )
    await expect(
      reads.hasActiveSettlementDependents("book", "settlement" as never)
    ).resolves.toBe(false)
  })
  it("returns the book currency with cash", async () => {
    const { reads } = prepared()
    await expect(
      reads.accountCash("book", ["a" as never], "2026-01-01")
    ).resolves.toEqual([
      { investmentAccountId: "a", cashMinor: "0", currency: "BRL" },
    ])
  })
  it("returns one cash state per requested account", async () => {
    const { reads } = prepared()
    await expect(
      reads.accountCash("book", ["a", "b"] as never, "2026-01-01")
    ).resolves.toHaveLength(2)
  })
})
