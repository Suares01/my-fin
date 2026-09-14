import {
  ArchiveLedgerAccount,
  CreateFinancialAccount,
  ReactivateLedgerAccount,
} from "@workspace/application"
import type { JournalEntrySnapshot } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

function archive(harness: ReturnType<typeof createHarness>) {
  return new ArchiveLedgerAccount(
    harness.transactionManager,
    harness.dispatcher
  )
}

function reactivate(harness: ReturnType<typeof createHarness>) {
  return new ReactivateLedgerAccount(
    harness.transactionManager,
    harness.dispatcher
  )
}

async function account(
  harness: ReturnType<typeof createHarness>,
  name: string,
  type: "BANK_ACCOUNT" | "CASH" | "INVESTMENT_ACCOUNT"
) {
  const result = await new CreateFinancialAccount(
    harness.transactionManager,
    harness.dispatcher,
    harness.ids
  ).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error(`Fixture failed: ${result.error.code}`)
  harness.publisher.clear()
  return result.value
}

function position(accountId: string, status: "OPEN" | "CLOSED") {
  return {
    id: "position-1" as never,
    bookId: "book-1" as never,
    investmentAccountId: accountId as never,
    instrumentId: "instrument-1" as never,
    normalizedLabel: "",
    quantityMode: "AMOUNT" as const,
    bookCostMinor: status === "OPEN" ? "100" : "0",
    currency: "BRL",
    openedOn: "2026-08-04",
    ...(status === "CLOSED" ? { closedOn: "2026-08-05" } : {}),
    status,
    allocationRevision: 1,
    allocationEffectiveOn: "2026-08-04",
    version: 0,
  }
}

function journal(accountId: string, amountMinor: bigint): JournalEntrySnapshot {
  return {
    id: "entry-1" as never,
    bookId: "book-1" as never,
    occurredOn: "2026-08-04",
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: "balance",
    currency: "BRL",
    origin: "MANUAL",
    postings: [
      {
        id: "entry-1-a" as never,
        accountId: accountId as never,
        amountMinor,
        currency: "BRL",
      },
      {
        id: "entry-1-b" as never,
        accountId: "counter" as never,
        amountMinor: -amountMinor,
        currency: "BRL",
      },
    ],
    version: 0,
  }
}

function archiveSnapshot(
  harness: ReturnType<typeof createHarness>,
  id: string,
  version = 0
) {
  harness.store.putAccount({
    ...harness.store.getAccount(id as never)!,
    status: "ARCHIVED",
    version,
  })
}

describe("investment account lifecycle policy", () => {
  it("archives an unused investment account while preserving its identity and profile", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        status: "ARCHIVED",
        version: 1,
      },
    })
    expect(
      harness.store.getAccount("account-5" as never)?.financialAccount
    ).toEqual({
      type: "INVESTMENT_ACCOUNT",
      investment: {},
    })
  })

  it("rejects archiving an investment account with an open position", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    harness.store.putInvestmentPosition(position("account-5", "OPEN"))
    const before = harness.store.snapshot()

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_ACCOUNT_IN_USE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects archiving an investment account with non-zero ledger balance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    harness.store.putJournalEntry(journal("account-5", 1n))
    const before = harness.store.snapshot()

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_ACCOUNT_IN_USE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("allows archive after a closed position and zero ledger balance", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    harness.store.putInvestmentPosition(position("account-5", "CLOSED"))

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { id: "account-5", status: "ARCHIVED", version: 1 },
    })
  })

  it("rejects archive of an active settlement account", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Bank", "BANK_ACCOUNT")
    harness.store.putAccount({
      id: "account-6" as never,
      bookId: "book-1" as never,
      name: "Broker",
      normalizedName: "broker",
      kind: "ASSET",
      status: "ACTIVE",
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: "account-5" as never },
      },
      version: 0,
    })
    const before = harness.store.snapshot()

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("does not block an already archived investment account that became historical", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    archiveSnapshot(harness, "account-5", 1)
    harness.store.putInvestmentPosition(position("account-5", "OPEN"))
    const before = harness.store.snapshot()

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { status: "ARCHIVED", version: 1 },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("reactivates an investment account with a valid active settlement preserving identity", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    const bank = await account(harness, "Bank", "BANK_ACCOUNT")
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      status: "ARCHIVED",
      version: 1,
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: bank.id as never },
      },
    })

    const result = await reactivate(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        status: "ACTIVE",
        version: 2,
      },
    })
    expect(
      harness.store.getAccount("account-5" as never)?.financialAccount
    ).toEqual({
      type: "INVESTMENT_ACCOUNT",
      investment: { defaultSettlementAccountId: "account-6" },
    })
  })

  it("rejects reactivation when settlement is inactive", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    const bank = await account(harness, "Bank", "BANK_ACCOUNT")
    archiveSnapshot(harness, "account-5", 1)
    harness.store.putAccount({
      ...harness.store.getAccount(bank.id as never)!,
      status: "ARCHIVED",
    })
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: bank.id as never },
      },
    })
    const before = harness.store.snapshot()

    const result = await reactivate(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects reactivation when settlement is from another book", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    archiveSnapshot(harness, "account-5", 1)
    harness.store.putAccount({
      id: "account-other" as never,
      bookId: "book-other" as never,
      name: "Other bank",
      normalizedName: "other bank",
      kind: "ASSET",
      status: "ACTIVE",
      financialAccount: { type: "BANK_ACCOUNT" },
      version: 0,
    })
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: "account-other" as never },
      },
    })
    const before = harness.store.snapshot()

    const result = await reactivate(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects reactivation when settlement is not bank or payment", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    const cash = await account(harness, "Cash", "CASH")
    archiveSnapshot(harness, "account-5", 1)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: cash.id as never },
      },
    })
    const before = harness.store.snapshot()

    const result = await reactivate(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects reactivation when settlement is missing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    archiveSnapshot(harness, "account-5", 1)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: "missing" as never },
      },
    })
    const before = harness.store.snapshot()

    const result = await reactivate(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects reactivation when the archived investment account settles itself", async () => {
    const harness = createHarness()
    await createBook(harness)
    await account(harness, "Broker", "INVESTMENT_ACCOUNT")
    archiveSnapshot(harness, "account-5", 1)
    harness.store.putAccount({
      ...harness.store.getAccount("account-5" as never)!,
      financialAccount: {
        type: "INVESTMENT_ACCOUNT",
        investment: { defaultSettlementAccountId: "account-5" as never },
      },
    })
    const before = harness.store.snapshot()

    const result = await reactivate(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("keeps generic categories on their existing lifecycle path", async () => {
    const harness = createHarness()
    await createBook(harness)
    harness.store.putAccount({
      id: "account-5" as never,
      bookId: "book-1" as never,
      name: "Food",
      normalizedName: "food",
      kind: "EXPENSE",
      status: "ACTIVE",
      iconKey: "restaurant",
      colorHex: "f43f5e",
      version: 0,
    })

    const result = await archive(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { kind: "EXPENSE", status: "ARCHIVED", version: 1 },
    })
  })
})
