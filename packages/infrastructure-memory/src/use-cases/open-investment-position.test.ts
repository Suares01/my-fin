import {
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  SetInvestmentOpeningBalance,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const account = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "Broker", type: "INVESTMENT_ACCOUNT" })
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!account.ok || !instrument.ok) throw new Error("fixture failed")
  h.publisher.clear()
  return h
}

function useCase(h: Awaited<ReturnType<typeof setup>>) {
  return new OpenInvestmentPosition(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  )
}

const command = {
  bookId: "book-1",
  requestId: "request-1",
  investmentAccountId: "account-5",
  instrumentId: "instrument-1",
  label: "Reserve",
  quantityMode: "AMOUNT",
  bookCostMinor: "1000",
  currency: "BRL",
  occurredOn: "2026-08-04",
} as const

describe("OpenInvestmentPosition", () => {
  it("creates a position and its opening allocation without a journal", async () => {
    const h = await setup()
    expect(await useCase(h).execute(command)).toEqual({
      ok: true,
      value: {
        requestId: "request-1",
        positionId: "position-1",
        positionVersion: 0,
        allocationRevision: 1,
        operationId: "operation-1",
        journalEntryIds: [],
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
    expect(h.store.listInvestmentOperations()[0]).toMatchObject({
      type: "OPENING_ALLOCATION",
      bookCostDeltaMinor: "1000",
      netCashFlowMinor: "0",
      cashMode: "NONE",
      positionBefore: { kind: "UNOPENED" },
    })
    expect(
      h.store.listInvestmentOperations()[0]?.journalEntryId
    ).toBeUndefined()
    expect(h.store.listJournalEntries()).toEqual([])
  })

  it("keeps known ledger cash separate from the allocated cost", async () => {
    const h = await setup()
    await new SetInvestmentOpeningBalance(
      h.transactionManager,
      h.dispatcher,
      h.ids,
      h.clock
    ).execute({
      bookId: "book-1",
      requestId: "balance",
      accountId: "account-5",
      amountMinor: "1500",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Opening",
    })
    expect(await useCase(h).execute(command)).toMatchObject({
      ok: true,
      value: { warnings: [] },
    })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      bookCostMinor: "1000",
    })
    expect(h.store.listJournalEntries()).toHaveLength(1)
  })

  it("replays the persisted result without a duplicate position or allocation", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(await useCase(h).execute(command)).toMatchObject({
      ok: true,
      value: { positionId: "position-1", operationId: "operation-1" },
    })
    expect(h.store.listInvestmentPositions()).toHaveLength(1)
    expect(h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("rejects changed semantic content for a reused request id", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(
      await useCase(h).execute({ ...command, bookCostMinor: "1200" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })

  it("requires a supplied book cost instead of using a valuation", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        bookCostMinor: undefined,
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_BOOK_COST_REQUIRED" },
    })
    expect(h.store.listInvestmentPositions()).toEqual([])
    expect(h.store.listInvestmentOperations()).toEqual([])
  })

  it("rejects a value-mode opening with zero cost", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, bookCostMinor: "0" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("allows a units opening with zero known cost", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({
        ...command,
        quantityMode: "UNITS",
        quantity: "10",
        bookCostMinor: "0",
      })
    ).toMatchObject({ ok: true, value: { warnings: [] } })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "0",
      status: "OPEN",
    })
  })

  it("rejects an amount opening that invents a quantity", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, quantity: "1" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("requires units for a units opening", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, quantityMode: "UNITS" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("rejects a missing book without writing", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, bookId: "missing" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(h.store.listInvestmentPositions()).toEqual([])
  })

  it("rejects a missing investment account without writing", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, investmentAccountId: "missing" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(h.store.listInvestmentOperations()).toEqual([])
  })

  it("rejects a missing instrument without writing", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, instrumentId: "missing" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(h.store.listInvestmentPositions()).toEqual([])
  })

  it("rejects an investment account from another book", async () => {
    const h = await setup()
    const otherBook = await new CreateFinancialBook(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({
      name: "Other book",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
    if (!otherBook.ok) throw new Error("fixture failed")
    const otherAccount = await new CreateFinancialAccount(
      h.transactionManager,
      h.dispatcher,
      h.ids
    ).execute({
      bookId: otherBook.value.id,
      name: "Other broker",
      type: "INVESTMENT_ACCOUNT",
    })
    if (!otherAccount.ok) throw new Error("fixture failed")
    expect(
      await useCase(h).execute({
        ...command,
        investmentAccountId: otherAccount.value.id,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "BOOK_MISMATCH" },
    })
  })

  it("preserves the operation occurrence date and first allocation revision", async () => {
    const h = await setup()
    await useCase(h).execute({ ...command, occurredOn: "2026-08-03" })
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      openedOn: "2026-08-03",
      allocationEffectiveOn: "2026-08-03",
      allocationRevision: 1,
    })
    expect(h.store.listInvestmentOperations()[0]).toMatchObject({
      occurredOn: "2026-08-03",
      sequence: "1",
    })
  })

  it("preserves label and no valuation for a plain allocation", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(h.store.listInvestmentPositions()[0]).toMatchObject({
      label: "Reserve",
      normalizedLabel: "reserve",
    })
    expect(h.store.listInvestmentValuations()).toEqual([])
  })

  it("does not persist an idempotency receipt for an invalid opening", async () => {
    const h = await setup()
    await useCase(h).execute({ ...command, quantityMode: "UNITS" })
    expect(
      h.store.getInvestmentRequest("book-1" as never, "request-1")
    ).toBeUndefined()
  })

  it("returns no warning when allocation exactly matches explicit ledger balance", async () => {
    const h = await setup()
    await new SetInvestmentOpeningBalance(
      h.transactionManager,
      h.dispatcher,
      h.ids,
      h.clock
    ).execute({
      bookId: "book-1",
      requestId: "balance",
      accountId: "account-5",
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Opening",
    })
    expect(await useCase(h).execute(command)).toMatchObject({
      ok: true,
      value: { warnings: [] },
    })
  })

  it("does not repeat a separately confirmed opening balance", async () => {
    const h = await setup()
    await new SetInvestmentOpeningBalance(
      h.transactionManager,
      h.dispatcher,
      h.ids,
      h.clock
    ).execute({
      bookId: "book-1",
      requestId: "balance",
      accountId: "account-5",
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Opening",
    })
    await useCase(h).execute(command)
    expect(h.store.listJournalEntries()).toHaveLength(1)
    expect(h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([expect.objectContaining({ amountMinor: 1000n })])
    )
  })
})
