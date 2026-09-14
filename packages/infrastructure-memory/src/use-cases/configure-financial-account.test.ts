import {
  ConfigureFinancialAccount,
  CreateFinancialAccount,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

function useCase(harness: ReturnType<typeof createHarness>) {
  return new ConfigureFinancialAccount(
    harness.transactionManager,
    harness.dispatcher
  )
}

async function createTypedAccount(
  harness: ReturnType<typeof createHarness>,
  name: string,
  type: "BANK_ACCOUNT" | "PAYMENT_ACCOUNT" | "CASH" | "INVESTMENT_ACCOUNT"
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

function positionFor(accountId: string) {
  return {
    id: "position-1" as never,
    bookId: "book-1" as never,
    investmentAccountId: accountId as never,
    instrumentId: "instrument-1" as never,
    normalizedLabel: "",
    quantityMode: "AMOUNT" as const,
    bookCostMinor: "100",
    currency: "BRL",
    openedOn: "2026-08-04",
    status: "OPEN" as const,
    allocationRevision: 1,
    allocationEffectiveOn: "2026-08-04",
    version: 0,
  }
}

describe("ConfigureFinancialAccount", () => {
  it("reclassifies between compatible types with the same account identity and no postings", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const beforeJournals = harness.store.listJournalEntries()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      profile: { type: "CASH", institutionName: " Cash desk " },
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        kind: "ASSET",
        version: 1,
        financialAccount: { type: "CASH", institutionName: "Cash desk" },
      },
    })
    expect(harness.store.getAccount("account-5" as never)).toMatchObject({
      id: "account-5",
      kind: "ASSET",
      financialAccount: { type: "CASH", institutionName: "Cash desk" },
    })
    expect(harness.store.listJournalEntries()).toEqual(beforeJournals)
  })

  it("is a no-op for the same normalized profile", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()
    harness.publisher.clear()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      profile: { type: "OTHER_ASSET" },
    })

    expect(result).toMatchObject({ ok: true, value: { version: 0 } })
    expect(harness.store.snapshot()).toEqual(before)
    expect(harness.publisher.events).toEqual([])
  })

  it("rejects a profile that changes the ledger kind", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      profile: { type: "CREDIT_CARD" },
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects removing investment classification after a historical position", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")
    harness.store.putInvestmentPosition(positionFor("account-5"))
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      profile: { type: "OTHER_ASSET" },
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects incompatible reclassification of an active settlement account", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Bank", "BANK_ACCOUNT")
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

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      profile: { type: "CASH" },
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects the investment account itself as settlement", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")

    const result = await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: "account-5",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
  })

  it("rejects an inactive settlement account", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")
    const bank = await createTypedAccount(harness, "Bank", "BANK_ACCOUNT")
    harness.store.putAccount({
      ...harness.store.getAccount(bank.id as never)!,
      status: "ARCHIVED",
    })

    const result = await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: bank.id,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
  })

  it("rejects a settlement account from another book", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")
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

    const result = await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: "account-other",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
  })

  it("rejects a settlement account that is not bank or payment", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")
    const cash = await createTypedAccount(harness, "Cash", "CASH")

    const result = await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: cash.id,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
  })

  it("rejects a missing settlement account", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")

    const result = await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: "missing",
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SETTLEMENT_ACCOUNT" },
    })
  })

  it("sets a valid settlement through the dedicated wrapper in one version", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")
    const bank = await createTypedAccount(harness, "Bank", "BANK_ACCOUNT")
    harness.publisher.clear()

    const result = await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: bank.id,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        version: 1,
        financialAccount: {
          type: "INVESTMENT_ACCOUNT",
          investment: { defaultSettlementAccountId: "account-6" },
        },
      },
    })
    expect(harness.publisher.events).toMatchObject([
      { type: "InvestmentSettlementAccountChanged", aggregateVersion: 1 },
    ])
  })

  it("clears settlement through the dedicated wrapper without changing identity", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createTypedAccount(harness, "Broker", "INVESTMENT_ACCOUNT")
    const bank = await createTypedAccount(harness, "Bank", "BANK_ACCOUNT")
    await useCase(harness).setInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 0,
      settlementAccountId: bank.id,
    })
    harness.publisher.clear()

    const result = await useCase(harness).clearInvestmentSettlementAccount({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "account-5",
        version: 2,
        financialAccount: { type: "INVESTMENT_ACCOUNT", investment: {} },
      },
    })
    expect(
      harness.store.getAccount("account-5" as never)?.financialAccount
    ).toEqual({
      type: "INVESTMENT_ACCOUNT",
      investment: {},
    })
  })

  it("rejects stale expected version without writing", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-5",
      expectedVersion: 1,
      profile: { type: "CASH" },
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })

  it("rejects an account from another book before mutation", async () => {
    const harness = createHarness()
    await createBook(harness)
    harness.store.putAccount({
      id: "account-other" as never,
      bookId: "book-other" as never,
      name: "Other",
      normalizedName: "other",
      kind: "ASSET",
      status: "ACTIVE",
      financialAccount: { type: "BANK_ACCOUNT" },
      version: 0,
    })
    const before = harness.store.snapshot()

    const result = await useCase(harness).execute({
      bookId: "book-1",
      accountId: "account-other",
      expectedVersion: 0,
      profile: { type: "CASH" },
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
    expect(harness.store.snapshot()).toEqual(before)
  })
})
