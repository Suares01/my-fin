import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentPurchase,
  RecordInvestmentSale,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup(openedOn = "2026-08-04") {
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
    if (!result.ok) throw new Error("fixture failed")
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
    if (!result.ok) throw new Error("fixture failed")
  }
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!instrument.ok) throw new Error("fixture failed")
  const opening = await new OpenInvestmentPosition(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  ).execute({
    bookId: "book-1",
    requestId: "open",
    investmentAccountId: "account-5",
    instrumentId: instrument.value.id,
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    occurredOn: openedOn,
  })
  if (!opening.ok) throw new Error("fixture failed")
  h.publisher.clear()
  return h
}
function useCase(h: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentPurchase(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  )
}
const internal = {
  bookId: "book-1",
  requestId: "purchase-1",
  positionId: "position-1",
  expectedPositionVersion: 0,
  type: "PURCHASE",
  occurredOn: "2026-08-04",
  description: "Purchase",
  currency: "BRL",
  quantityDelta: "2",
  capitalMinor: "200",
  funding: { mode: "INTERNAL_CASH" },
} as const

describe("RecordInvestmentPurchase", () => {
  it.each([
    ["PURCHASE", "closed"],
    ["PURCHASE", "archived account"],
    ["PURCHASE", "archived instrument"],
    ["APPLICATION", "closed"],
    ["APPLICATION", "archived account"],
    ["APPLICATION", "archived instrument"],
  ] as const)(
    "rejects %s on a %s allocation without writes",
    async (type, state) => {
      const h = await setup()
      let expectedPositionVersion = 0
      if (state === "closed") {
        expect(
          await new RecordInvestmentSale(
            h.transactionManager,
            h.dispatcher,
            h.ids,
            h.clock
          ).execute({
            bookId: "book-1",
            requestId: "close-position",
            positionId: "position-1",
            expectedPositionVersion: 0,
            type: "SALE",
            occurredOn: "2026-08-04",
            description: "Close at cost",
            currency: "BRL",
            quantityDelta: "10",
            bookCostReductionMinor: "1000",
            grossProceedsMinor: "1000",
            destination: { mode: "INTERNAL_CASH" },
          })
        ).toMatchObject({ ok: true })
        expectedPositionVersion = 1
      } else if (state === "archived account") {
        const account = h.store.getAccount("account-5" as never)
        if (account === undefined) throw new Error("fixture failed")
        h.store.putAccount({ ...account, status: "ARCHIVED", version: 1 })
      } else {
        const instrument = h.store.listInvestmentInstruments()[0]
        if (instrument === undefined) throw new Error("fixture failed")
        h.store.putInvestmentInstrument({
          ...instrument,
          status: "ARCHIVED",
          version: 1,
        })
      }
      const before = h.store.snapshot()
      expect(
        await useCase(h).execute({
          ...internal,
          type,
          requestId: `inactive-${type}-${state}`,
          expectedPositionVersion,
        })
      ).toMatchObject({
        ok: false,
        error: { code: "INVESTMENT_ENTITY_NOT_ACTIVE" },
      })
      expect(h.store.snapshot()).toEqual(before)
    }
  )

  it("rejects a purchase before the opening operation without writes", async () => {
    const h = await setup()
    const before = h.store.snapshot()
    expect(
      await useCase(h).execute({ ...internal, occurredOn: "2026-08-03" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(h.store.snapshot()).toEqual(before)
  })

  it.each([
    ["precision", "123456789012345678901234567890123456789"],
    ["scale", "1.1234567890123456789"],
  ] as const)(
    "rejects quantity beyond the decimal %s limit before writing",
    async (_limit, quantityDelta) => {
      const h = await setup()
      const before = h.store.snapshot()
      expect(
        await useCase(h).execute({
          ...internal,
          quantityDelta,
        })
      ).toMatchObject({
        ok: false,
        error: { code: "INVALID_INVESTMENT_INPUT" },
      })
      expect(h.store.snapshot()).toEqual(before)
    }
  )

  it("uses the last effective date and orders same-day operations by persisted sequence", async () => {
    const h = await setup("2026-08-01")
    expect(await useCase(h).execute(internal)).toMatchObject({ ok: true })
    const before = h.store.snapshot()
    expect(
      await useCase(h).execute({
        ...internal,
        requestId: "backdated",
        expectedPositionVersion: 1,
        occurredOn: "2026-08-03",
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(h.store.snapshot()).toEqual(before)

    expect(
      await useCase(h).execute({
        ...internal,
        requestId: "same-day",
        expectedPositionVersion: 1,
      })
    ).toMatchObject({ ok: true, value: { operationId: "operation-3" } })
    expect(h.store.listInvestmentOperations().slice(1)).toMatchObject([
      { occurredOn: "2026-08-04", sequence: "2" },
      { occurredOn: "2026-08-04", sequence: "3" },
    ])
  })

  it("records an internal purchase without a journal and increases only explicit cost and units", async () => {
    const h = await setup()
    expect(await useCase(h).execute(internal)).toMatchObject({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 1,
        allocationRevision: 2,
        operationId: "operation-2",
        journalEntryIds: [],
      },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "12",
      bookCostMinor: "1200",
    })
    expect(h.store.listJournalEntries()).toEqual([])
    expect(
      BigInt(h.store.listInvestmentOperations()[1]!.sequence) >
        BigInt(h.store.listInvestmentOperations()[0]!.sequence)
    ).toBe(true)
  })
  it("records only informed expenses for an internal purchase", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...internal,
        requestId: "internal-with-expenses",
        feesMinor: "10",
        taxesMinor: "5",
        feeCategoryId: "account-7",
        taxCategoryId: "account-8",
      })
    ).toMatchObject({
      ok: true,
      value: {
        operationId: "operation-2",
        journalEntryIds: ["entry-1"],
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "account-5",
            cashMinor: "-1215",
          },
        ],
      },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "12",
      bookCostMinor: "1200",
    })
    expect(h.store.listInvestmentOperations()[1]).toMatchObject({
      bookCostDeltaMinor: "200",
      netCashFlowMinor: "-215",
      feesMinor: "10",
      taxesMinor: "5",
    })
    expect(h.store.listJournalEntries()).toMatchObject([
      {
        postings: [
          { accountId: "account-5", amountMinor: -15n },
          { accountId: "account-7", amountMinor: 10n },
          { accountId: "account-8", amountMinor: 5n },
        ],
      },
    ])
  })
  it("records an external application in one journal with non-capitalized expenses", async () => {
    const h = await setup()
    const result = await useCase(h).execute({
      ...internal,
      requestId: "application",
      type: "APPLICATION",
      capitalMinor: "200",
      feesMinor: "10",
      taxesMinor: "5",
      feeCategoryId: "account-7",
      taxCategoryId: "account-8",
      funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-6" },
    })
    expect(result).toMatchObject({
      ok: true,
      value: { journalEntryIds: ["entry-1"], operationId: "operation-2" },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      bookCostMinor: "1200",
      quantity: "12",
    })
    expect(h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: "account-6", amountMinor: -215n }),
        expect.objectContaining({ accountId: "account-5", amountMinor: 200n }),
        expect.objectContaining({ accountId: "account-7", amountMinor: 10n }),
        expect.objectContaining({ accountId: "account-8", amountMinor: 5n }),
      ])
    )
  })
  it("requires an explicit internal or external route", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...internal,
        funding: { mode: "NONE" },
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })
  it("rejects a stale position version without an operation", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...internal, expectedPositionVersion: 1 })
    ).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("recomputes cash warnings after competing purchases commit", async () => {
    const h = await setup()
    const first = { ...internal, requestId: "competing-purchase-1" }
    const second = { ...internal, requestId: "competing-purchase-2" }
    const [firstResult, secondResult] = await Promise.all([
      useCase(h).execute(first),
      useCase(h).execute(second),
    ])
    expect(firstResult).toMatchObject({
      ok: true,
      value: {
        positionVersion: 1,
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "account-5",
            cashMinor: "-1200",
          },
        ],
      },
    })
    expect(secondResult).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(h.store.listInvestmentOperations()).toHaveLength(2)

    expect(
      await useCase(h).execute({ ...second, expectedPositionVersion: 1 })
    ).toMatchObject({
      ok: true,
      value: {
        positionVersion: 2,
        warnings: [
          {
            code: "INVESTMENT_CASH_NEGATIVE",
            investmentAccountId: "account-5",
            cashMinor: "-1400",
          },
        ],
      },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "14",
      bookCostMinor: "1400",
      version: 2,
    })
    expect(h.store.listInvestmentOperations()).toHaveLength(3)
  })
  it("replays a matching request without a duplicate operation", async () => {
    const h = await setup()
    await useCase(h).execute(internal)
    expect(await useCase(h).execute(internal)).toMatchObject({
      ok: true,
      value: { operationId: "operation-2" },
    })
    expect(h.store.listInvestmentOperations()).toHaveLength(2)
  })
  it("rejects changed content under a reused request", async () => {
    const h = await setup()
    await useCase(h).execute(internal)
    expect(
      await useCase(h).execute({ ...internal, capitalMinor: "201" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })
  it("rejects an external account from another book or wrong kind", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...internal,
        funding: { mode: "EXTERNAL_ACCOUNT", accountId: "account-5" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })
  it("requires a fee category for a nonzero fee", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...internal, feesMinor: "1" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })
  it("requires a tax category for a nonzero tax", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...internal, taxesMinor: "1" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })
  it("records the supplied settlement date", async () => {
    const h = await setup()
    await useCase(h).execute({ ...internal, settledOn: "2026-08-05" })
    expect(h.store.listInvestmentOperations()[1]).toMatchObject({
      settledOn: "2026-08-05",
    })
  })
  it("records application as its distinct business type", async () => {
    const h = await setup()
    await useCase(h).execute({ ...internal, type: "APPLICATION" })
    expect(h.store.listInvestmentOperations()[1]).toMatchObject({
      type: "APPLICATION",
    })
  })
  it("warns instead of rejecting negative investment cash", async () => {
    const h = await setup()
    expect(await useCase(h).execute(internal)).toMatchObject({
      ok: true,
      value: {
        warnings: [
          expect.objectContaining({
            code: "INVESTMENT_CASH_NEGATIVE",
            cashMinor: "-1200",
          }),
        ],
      },
    })
  })
  it("rejects a purchase on a missing position", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...internal, positionId: "missing" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
  })
  it("rejects non-positive capital", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...internal, capitalMinor: "0" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })
  it("rejects a units purchase without quantity", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...internal,
        quantityDelta: undefined,
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })
  it("preserves the operation snapshot before the allocation", async () => {
    const h = await setup()
    await useCase(h).execute(internal)
    expect(h.store.listInvestmentOperations()[1]).toMatchObject({
      positionBefore: {
        kind: "EXISTING",
        quantity: "10",
        bookCostMinor: "1000",
        status: "OPEN",
      },
      bookCostDeltaMinor: "200",
      netCashFlowMinor: "-200",
    })
  })
})
