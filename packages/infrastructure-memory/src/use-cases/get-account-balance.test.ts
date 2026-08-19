import { GetAccountBalance, type LedgerQueries } from "@workspace/application"
import type {
  BookId,
  JournalEntrySnapshot,
  LedgerAccountSnapshot,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { InMemoryLedgerAccountRepository } from "../repositories/in-memory-ledger-account-repository.js"
import { InMemoryStore } from "../store/in-memory-store.js"
import { InMemoryLedgerQueries } from "../queries/in-memory-ledger-queries.js"
import {
  createBook,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

const bookId = "book-1" as BookId

function accountSnapshot(
  kind: "ASSET" | "LIABILITY",
  id = "account-5"
): LedgerAccountSnapshot {
  return {
    id: id as never,
    bookId,
    name: kind === "ASSET" ? "Checking" : "Credit card",
    normalizedName: kind === "ASSET" ? "checking" : "credit card",
    kind,
    status: "ACTIVE",
    version: 0,
  }
}

function journalEntry(
  id: string,
  occurredOn: string,
  accountId: string,
  amountMinor: bigint
): JournalEntrySnapshot {
  return {
    id: id as never,
    bookId,
    occurredOn,
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: id,
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

function useCase(
  store: InMemoryStore,
  queries: LedgerQueries = new InMemoryLedgerQueries(store)
) {
  return new GetAccountBalance(
    new InMemoryLedgerAccountRepository(store),
    queries
  )
}

describe("GetAccountBalance", () => {
  it("returns exact serializable balance, currency and as-of date", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness, "ASSET")
    harness.store.putJournalEntry(
      journalEntry("entry-before", "2026-08-01", "account-5", 100n)
    )
    harness.store.putJournalEntry(
      journalEntry("entry-after", "2026-08-05", "account-5", 900n)
    )

    const result = await useCase(harness.store).execute({
      bookId: "book-1",
      accountId: "account-5",
      asOf: "2026-08-01",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        accountId: "account-5",
        accountName: "Checking",
        accountKind: "ASSET",
        rawBalanceMinor: "100",
        displayBalanceMinor: "100",
        asOf: "2026-08-01",
        amountMinor: "100",
        currency: "BRL",
      },
    })
  })

  it("exposes a liability balance with its displayed sign", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness, "LIABILITY")
    harness.store.putJournalEntry(
      journalEntry("entry-liability", "2026-08-01", "account-5", 100n)
    )

    const result = await useCase(harness.store).execute({
      bookId: "book-1",
      accountId: "account-5",
    })

    expect(result).toMatchObject({
      ok: true,
      value: { amountMinor: "-100", asOf: null, currency: "BRL" },
    })
  })

  it("returns ENTITY_NOT_FOUND for a missing account without querying", async () => {
    const store = new InMemoryStore()
    const queries: LedgerQueries = {
      getAccountBalance: async () => {
        throw new Error("cross-book query should not run")
      },
    }

    const result = await useCase(store, queries).execute({
      bookId: "book-1",
      accountId: "missing",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
  })

  it("returns ENTITY_NOT_FOUND for an account from another book without querying", async () => {
    const store = new InMemoryStore()
    store.putAccount(accountSnapshot("ASSET", "foreign-account"))
    store.putAccount({
      ...accountSnapshot("ASSET", "foreign-account"),
      bookId: "book-2" as BookId,
    })
    const queries: LedgerQueries = {
      getAccountBalance: async () => {
        throw new Error("cross-book query should not run")
      },
    }

    const result = await useCase(store, queries).execute({
      bookId: "book-1",
      accountId: "foreign-account",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    })
  })

  it("rejects an invalid as-of date with the stable date error", async () => {
    const store = new InMemoryStore()
    store.putAccount(accountSnapshot("ASSET"))
    const queries: LedgerQueries = {
      getAccountBalance: async () => {
        throw new Error("invalid date should stop before querying")
      },
    }

    const result = await useCase(store, queries).execute({
      bookId: "book-1",
      accountId: "account-5",
      asOf: "2026-02-30",
    })

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DATE" } })
  })

  it("maps an unexpected query failure to the public error boundary", async () => {
    const store = new InMemoryStore()
    store.putAccount(accountSnapshot("ASSET"))
    const queries: LedgerQueries = {
      getAccountBalance: async () => {
        throw new Error("query failed")
      },
    }

    const result = await useCase(store, queries).execute({
      bookId: "book-1",
      accountId: "account-5",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
    }
  })
})
