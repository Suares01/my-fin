import type {
  BookId,
  JournalEntrySnapshot,
  LedgerAccountKind,
  LedgerAccountSnapshot,
} from "@workspace/domain"
import { LocalDate } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryLedgerQueries } from "./in-memory-ledger-queries.js"

const bookId = "book-1" as BookId
const accountKinds: readonly LedgerAccountKind[] = [
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "EQUITY",
]

function account(
  id: string,
  kind: LedgerAccountKind,
  currentBookId: BookId = bookId
): LedgerAccountSnapshot {
  return {
    id: id as never,
    bookId: currentBookId,
    name: id,
    normalizedName: id,
    kind,
    status: "ACTIVE",
    version: 0,
  }
}

function entry(
  id: string,
  occurredOn: string,
  accountId: string,
  amountMinor: bigint,
  currentBookId: BookId = bookId,
  description = id,
  sequence = "1"
): JournalEntrySnapshot {
  return {
    id: id as never,
    bookId: currentBookId,
    occurredOn,
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence,
    description,
    currency: "BRL",
    origin: "MANUAL",
    postings: [
      {
        id: `${id}-posting` as never,
        accountId: accountId as never,
        amountMinor,
        currency: "BRL",
      },
      {
        id: `${id}-counter` as never,
        accountId: `${id}-counter` as never,
        amountMinor: -amountMinor,
        currency: "BRL",
      },
    ],
    version: 0,
  }
}

function prepared() {
  const store = new InMemoryStore()
  store.putBook({
    id: bookId,
    name: "Main",
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
    version: 0,
  })
  return { store, queries: new InMemoryLedgerQueries(store) }
}

describe("InMemoryLedgerQueries", () => {
  it("includes only postings on or before the requested date", async () => {
    const { store, queries } = prepared()
    store.putAccount(account("account-asset", "ASSET"))
    store.putJournalEntry(entry("entry-1", "2026-08-01", "account-asset", 100n))
    store.putJournalEntry(entry("entry-2", "2026-08-03", "account-asset", -40n))
    store.putJournalEntry(entry("entry-3", "2026-08-05", "account-asset", 10n))

    const result = await queries.getAccountBalance({
      bookId,
      accountId: "account-asset" as never,
      asOf: LocalDate.parse("2026-08-03"),
    })

    expect(result).toEqual({
      accountId: "account-asset",
      accountName: "account-asset",
      accountKind: "ASSET",
      rawBalanceMinor: "60",
      displayBalanceMinor: "60",
      asOf: "2026-08-03",
      amountMinor: "60",
      currency: "BRL",
    })
  })

  it("uses the book currency and returns the full derived balance without a date limit", async () => {
    const { store, queries } = prepared()
    store.putAccount(account("account-asset", "ASSET"))
    store.putJournalEntry(entry("entry-1", "2026-08-01", "account-asset", 100n))

    const result = await queries.getAccountBalance({
      bookId,
      accountId: "account-asset" as never,
    })

    expect(result.currency).toBe("BRL")
    expect(result.accountName).toBe("account-asset")
    expect(result.accountKind).toBe("ASSET")
    expect(result.rawBalanceMinor).toBe("100")
    expect(result.displayBalanceMinor).toBe("100")
    expect(result.asOf).toBeNull()
    expect(result.amountMinor).toBe("100")
    expect(result.amountMinor).toBe(result.displayBalanceMinor)
  })

  it.each([
    ["ASSET", "100"],
    ["LIABILITY", "-100"],
    ["INCOME", "-100"],
    ["EXPENSE", "100"],
    ["EQUITY", "-100"],
  ] as const)(
    "shows a %s balance using its normal balance sign",
    async (kind, expected) => {
      const { store, queries } = prepared()
      const accountId = `account-${kind}`
      store.putAccount(account(accountId, kind))
      store.putJournalEntry(
        entry(`entry-${kind}`, "2026-08-01", accountId, 100n)
      )

      const result = await queries.getAccountBalance({
        bookId,
        accountId: accountId as never,
      })

      expect(result.amountMinor).toBe(expected)
    }
  )

  it("does not combine postings from another book", async () => {
    const { store, queries } = prepared()
    const otherBookId = "book-2" as BookId
    store.putBook({
      id: otherBookId,
      name: "Other",
      baseCurrency: "USD",
      timezone: "UTC",
      version: 0,
    })
    store.putAccount(account("account-asset", "ASSET"))
    store.putAccount(account("account-other", "ASSET", otherBookId))
    store.putJournalEntry(
      entry("entry-main", "2026-08-01", "account-asset", 100n)
    )
    store.putJournalEntry(
      entry("entry-other", "2026-08-01", "account-asset", 900n, otherBookId)
    )

    const result = await queries.getAccountBalance({
      bookId,
      accountId: "account-asset" as never,
    })

    expect(result.amountMinor).toBe("100")
    expect(result.currency).toBe("BRL")
  })

  it.each(accountKinds)(
    "returns an empty derived balance for a %s account with no postings",
    async (kind) => {
      const { store, queries } = prepared()
      const accountId = `empty-${kind}`
      store.putAccount(account(accountId, kind))

      const result = await queries.getAccountBalance({
        bookId,
        accountId: accountId as never,
      })

      expect(result).toEqual({
        accountId,
        accountName: accountId,
        accountKind: kind,
        rawBalanceMinor: "0",
        displayBalanceMinor: "0",
        asOf: null,
        amountMinor: "0",
        currency: "BRL",
      })
    }
  )
})
