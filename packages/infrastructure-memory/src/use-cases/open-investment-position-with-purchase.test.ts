import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateInvestmentInstrument,
  OpenInvestmentPositionWithPurchase,
} from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  for (const [name, type] of [
    ["Broker", "INVESTMENT_ACCOUNT"],
    ["Bank", "BANK_ACCOUNT"],
  ] as const) {
    const result = await new CreateFinancialAccount(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({ bookId: "book-1", name, type })
    if (!result.ok) throw new Error("account fixture failed")
  }
  for (const name of ["Fee", "Tax"]) {
    const result = await new CreateExpenseCategory(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({
      bookId: "book-1",
      name,
      kind: "EXPENSE",
      iconKey: "receipt",
      colorHex: "f43f5e",
    })
    if (!result.ok) throw new Error("category fixture failed")
  }
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!instrument.ok) throw new Error("instrument fixture failed")
  h.publisher.clear()
  return h
}

const command = {
  bookId: "book-1",
  requestId: "opening-purchase",
  investmentAccountId: "account-5",
  instrumentId: "instrument-1",
  label: "Reserve",
  quantityMode: "UNITS",
  quantityDelta: "10",
  type: "PURCHASE",
  occurredOn: "2026-08-04",
  description: "Initial purchase",
  currency: "BRL",
  capitalMinor: "1000",
  funding: { mode: "INTERNAL_CASH" },
} as const

function useCase(h: Awaited<ReturnType<typeof setup>>) {
  return new OpenInvestmentPositionWithPurchase(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  )
}

describe("OpenInvestmentPositionWithPurchase", () => {
  it("opens one position and one PURCHASE without opening allocation or implicit journal", async () => {
    const h = await setup()
    expect(await useCase(h).execute(command)).toMatchObject({
      ok: true,
      value: {
        requestId: "opening-purchase",
        positionId: "position-1",
        positionVersion: 0,
        allocationRevision: 1,
        operationId: "operation-1",
        journalEntryIds: [],
      },
    })
    expect(h.store.listInvestmentPositions()).toMatchObject([
      { quantity: "10", bookCostMinor: "1000", label: "Reserve" },
    ])
    expect(h.store.listInvestmentOperations()).toMatchObject([
      {
        type: "PURCHASE",
        positionBefore: { kind: "UNOPENED" },
        bookCostDeltaMinor: "1000",
        netCashFlowMinor: "-1000",
      },
    ])
    expect(h.store.listJournalEntries()).toEqual([])
  })

  it("posts one external APPLICATION journal with exact principal and expense postings", async () => {
    const h = await setup()
    const result = await useCase(h).execute({
      ...command,
      type: "APPLICATION",
      funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-6" },
      feesMinor: "10",
      taxesMinor: "5",
      feeCategoryId: "account-7",
      taxCategoryId: "account-8",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { operationId: "operation-1", journalEntryIds: ["entry-1"] },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      bookCostMinor: "1000",
      quantity: "10",
    })
    expect(h.store.listInvestmentOperations()).toMatchObject([
      {
        type: "APPLICATION",
        feesMinor: "10",
        taxesMinor: "5",
        journalEntryId: "entry-1",
        positionBefore: { kind: "UNOPENED" },
      },
    ])
    expect(h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: "account-6",
          amountMinor: -1015n,
        }),
        expect.objectContaining({ accountId: "account-5", amountMinor: 1000n }),
        expect.objectContaining({ accountId: "account-7", amountMinor: 10n }),
        expect.objectContaining({ accountId: "account-8", amountMinor: 5n }),
      ])
    )
    expect(h.store.listJournalEntries()).toHaveLength(1)
  })

  it("saves internal expense postings in the operation journal without FEE or TAX operations", async () => {
    const h = await setup()
    await useCase(h).execute({
      ...command,
      feesMinor: "10",
      feeCategoryId: "account-7",
    })
    expect(h.store.listInvestmentOperations()).toHaveLength(1)
    expect(h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: "account-5", amountMinor: -10n }),
        expect.objectContaining({ accountId: "account-7", amountMinor: 10n }),
      ])
    )
  })

  it("confirms internal opening with negative cash warning and no opening balance", async () => {
    const h = await setup()
    expect(await useCase(h).execute(command)).toMatchObject({
      ok: true,
      value: {
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "account-5",
            cashMinor: "-1000",
            currency: "BRL",
            asOf: "2026-08-04",
          },
        ],
      },
    })
    expect(h.store.listJournalEntries()).toEqual([])
  })

  it("replays an equivalent request with its original IDs and no duplicate effects", async () => {
    const h = await setup()
    const first = await useCase(h).execute(command)
    expect(await useCase(h).execute(command)).toEqual(first)
    expect(h.store.listInvestmentPositions()).toHaveLength(1)
    expect(h.store.listInvestmentOperations()).toHaveLength(1)
    expect(h.store.listJournalEntries()).toHaveLength(0)
  })

  it("rejects changed semantic content under the same request ID", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(
      await useCase(h).execute({ ...command, capitalMinor: "1200" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
    expect(h.store.listInvestmentPositions()).toHaveLength(1)
  })

  it("rejects a missing explicit funding route without partial state", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, funding: undefined } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(h.store.listInvestmentPositions()).toEqual([])
    expect(
      h.store.getInvestmentRequest("book-1" as never, command.requestId)
    ).toBeUndefined()
  })

  it("rejects a different currency without partial state", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, currency: "USD" })
    ).toMatchObject({
      ok: false,
      error: { code: "CURRENCY_MISMATCH" },
    })
    expect(h.store.listInvestmentOperations()).toEqual([])
  })

  it("rejects zero capital without a position or receipt", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, capitalMinor: "0" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(h.store.listInvestmentPositions()).toEqual([])
    expect(
      h.store.getInvestmentRequest("book-1" as never, command.requestId)
    ).toBeUndefined()
  })

  it("requires quantity for a units opening", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        quantityDelta: undefined,
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(h.store.listInvestmentPositions()).toEqual([])
  })

  it("allows amount mode without quantity", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        quantityMode: "AMOUNT",
        quantityDelta: undefined,
      } as never)
    ).toMatchObject({ ok: true, value: { positionVersion: 0 } })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantityMode: "AMOUNT",
      bookCostMinor: "1000",
    })
  })

  it("requires an expense category for nonzero fees", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, feesMinor: "10" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
    expect(h.store.listInvestmentPositions()).toEqual([])
  })

  it("rejects an external route to the investment account", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-5" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(h.store.listInvestmentOperations()).toEqual([])
  })

  it("rejects a missing investment account without side effects", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        investmentAccountId: "missing",
      })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(h.store.listInvestmentPositions()).toEqual([])
  })

  it("rejects a missing instrument without side effects", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        instrumentId: "missing",
      })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(h.store.listInvestmentPositions()).toEqual([])
  })

  it("rolls back journal, position, operation and receipt after a late write failure", async () => {
    const h = await setup()
    vi.spyOn(h.store, "putInvestmentOperation").mockImplementationOnce(() => {
      throw new Error("injected operation write failure")
    })
    expect(
      await useCase(h).execute({
        ...command,
        funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-6" },
      })
    ).toMatchObject({ ok: false })
    expect(h.store.listInvestmentPositions()).toEqual([])
    expect(h.store.listInvestmentOperations()).toEqual([])
    expect(h.store.listJournalEntries()).toEqual([])
    expect(
      h.store.getInvestmentRequest("book-1" as never, command.requestId)
    ).toBeUndefined()
  })
})
