import {
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateFinancialBook,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentSale,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup(input?: {
  readonly quantityMode?: "UNITS" | "AMOUNT"
  readonly quantity?: string
  readonly bookCostMinor?: string
}) {
  const h = createHarness()
  await createBook(h)
  const broker = await financialAccount(h, "Broker", "INVESTMENT_ACCOUNT")
  const bank = await financialAccount(h, "Bank", "BANK_ACCOUNT")
  const gain = await incomeCategory(h, "Gain")
  const loss = await expenseCategory(h, "Loss")
  const fee = await expenseCategory(h, "Fee")
  const tax = await expenseCategory(h, "Tax")
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
    investmentAccountId: broker.id,
    instrumentId: instrument.value.id,
    quantityMode: input?.quantityMode ?? "UNITS",
    ...(input?.quantityMode === "AMOUNT"
      ? {}
      : { quantity: input?.quantity ?? "10" }),
    bookCostMinor: input?.bookCostMinor ?? "1000",
    occurredOn: "2026-08-04",
  })
  if (!opening.ok) throw new Error("fixture failed")
  h.publisher.clear()
  return { h, broker, bank, gain, loss, fee, tax }
}

async function financialAccount(
  h: ReturnType<typeof createHarness>,
  name: string,
  type: "INVESTMENT_ACCOUNT" | "BANK_ACCOUNT"
) {
  const result = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

async function expenseCategory(
  h: ReturnType<typeof createHarness>,
  name: string
) {
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
  return result.value
}

async function incomeCategory(
  h: ReturnType<typeof createHarness>,
  name: string
) {
  const result = await new CreateIncomeCategory(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({
    bookId: "book-1",
    name,
    kind: "INCOME",
    iconKey: "chart",
    colorHex: "10b981",
  })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

function useCase(fixture: Awaited<ReturnType<typeof setup>>) {
  return new RecordInvestmentSale(
    fixture.h.transactionManager,
    fixture.h.dispatcher,
    fixture.h.ids,
    fixture.h.clock
  )
}

function sale(fixture: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1",
    requestId: "sale-1",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "SALE" as const,
    occurredOn: "2026-08-04",
    description: "Sale",
    currency: "BRL",
    quantityDelta: "4",
    bookCostReductionMinor: "400",
    grossProceedsMinor: "500",
    destination: { mode: "INTERNAL_CASH" as const },
    gainCategoryId: fixture.gain.id,
    lossCategoryId: fixture.loss.id,
    feeCategoryId: fixture.fee.id,
    taxCategoryId: fixture.tax.id,
  }
}

describe("RecordInvestmentSale", () => {
  it("records an internal partial sale with its explicit cost, units and gain", async () => {
    const f = await setup()
    expect(await useCase(f).execute(sale(f))).toMatchObject({
      ok: true,
      value: {
        positionId: "position-1",
        positionVersion: 1,
        allocationRevision: 2,
        operationId: "operation-2",
        journalEntryIds: ["entry-1"],
      },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "6",
      bookCostMinor: "600",
      status: "OPEN",
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.broker.id, amountMinor: 100n }),
        expect.objectContaining({ accountId: f.gain.id, amountMinor: -100n }),
      ])
    )
  })

  it("records an internal loss in the configured expense category", async () => {
    const f = await setup()
    await useCase(f).execute({ ...sale(f), grossProceedsMinor: "300" })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.broker.id, amountMinor: -100n }),
        expect.objectContaining({ accountId: f.loss.id, amountMinor: 100n }),
      ])
    )
  })

  it("records gain, fee and tax as distinct postings in one internal sale", async () => {
    const f = await setup()
    await useCase(f).execute({
      ...sale(f),
      feesMinor: "20",
      taxesMinor: "30",
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.broker.id, amountMinor: 50n }),
        expect.objectContaining({ accountId: f.gain.id, amountMinor: -100n }),
        expect.objectContaining({ accountId: f.fee.id, amountMinor: 20n }),
        expect.objectContaining({ accountId: f.tax.id, amountMinor: 30n }),
      ])
    )
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({
      feesMinor: "20",
      taxesMinor: "30",
      netCashFlowMinor: "450",
    })
  })

  it("posts an external sale directly to the bank without a second transfer", async () => {
    const f = await setup()
    await useCase(f).execute({
      ...sale(f),
      feesMinor: "20",
      taxesMinor: "30",
      destination: { mode: "EXTERNAL_ACCOUNT", accountId: f.bank.id },
    })
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.bank.id, amountMinor: 450n }),
        expect.objectContaining({ accountId: f.broker.id, amountMinor: -400n }),
        expect.objectContaining({ accountId: f.gain.id, amountMinor: -100n }),
        expect.objectContaining({ accountId: f.fee.id, amountMinor: 20n }),
        expect.objectContaining({ accountId: f.tax.id, amountMinor: 30n }),
      ])
    )
  })

  it("records the normative direct redemption and closes the position", async () => {
    const f = await setup({ bookCostMinor: "5000" })
    const result = await useCase(f).execute({
      ...sale(f),
      type: "REDEMPTION",
      quantityDelta: "10",
      bookCostReductionMinor: "5000",
      grossProceedsMinor: "5100",
      taxesMinor: "20",
      destination: { mode: "EXTERNAL_ACCOUNT", accountId: f.bank.id },
    })
    expect(result).toMatchObject({
      ok: true,
      value: { journalEntryIds: ["entry-1"] },
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.bank.id, amountMinor: 5080n }),
        expect.objectContaining({
          accountId: f.broker.id,
          amountMinor: -5000n,
        }),
        expect.objectContaining({ accountId: f.gain.id, amountMinor: -100n }),
        expect.objectContaining({ accountId: f.tax.id, amountMinor: 20n }),
      ])
    )
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
      closedOn: "2026-08-04",
    })
  })

  it("persists a sale at cost internally without a journal", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        quantityDelta: "10",
        bookCostReductionMinor: "1000",
        grossProceedsMinor: "1000",
      })
    ).toMatchObject({ ok: true, value: { journalEntryIds: [] } })
    expect(f.h.store.listJournalEntries()).toEqual([])
  })

  it("closes an amount position when its explicit remaining cost reaches zero", async () => {
    const f = await setup({ quantityMode: "AMOUNT" })
    await useCase(f).execute({
      ...sale(f),
      quantityDelta: undefined,
      bookCostReductionMinor: "1000",
      grossProceedsMinor: "1000",
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: undefined,
      bookCostMinor: "0",
      status: "CLOSED",
      closedOn: "2026-08-04",
    })
  })

  it("keeps a zero-cost units position open after a partial sale", async () => {
    const f = await setup({ bookCostMinor: "0" })
    await useCase(f).execute({
      ...sale(f),
      bookCostReductionMinor: "0",
      grossProceedsMinor: "100",
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "6",
      bookCostMinor: "0",
      status: "OPEN",
    })
    expect(f.h.store.listJournalEntries()[0]?.postings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: f.broker.id, amountMinor: 100n }),
        expect.objectContaining({ accountId: f.gain.id, amountMinor: -100n }),
      ])
    )
  })

  it("rejects reducing all units while leaving positive cost", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...sale(f), quantityDelta: "10" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("rejects a cost reduction above the explicit remaining cost", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...sale(f), bookCostReductionMinor: "1001" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("rejects a quantity reduction above the controlled units", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...sale(f), quantityDelta: "11" })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("requires explicit units for a units position", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        quantityDelta: undefined,
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("requires a valid income category for a positive gross gain", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...sale(f), gainCategoryId: undefined })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("requires a valid expense category for a loss", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        grossProceedsMinor: "300",
        lossCategoryId: undefined,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("requires a fee category for a nonzero fee", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        feesMinor: "1",
        feeCategoryId: undefined,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("requires a tax category for a nonzero tax", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        taxesMinor: "1",
        taxCategoryId: undefined,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_CATEGORY" },
    })
  })

  it("rejects an omitted explicit book-cost reduction", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        bookCostReductionMinor: undefined,
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("rejects a route other than internal cash or an external account", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        destination: { mode: "NONE" },
      } as never)
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })

  it("rejects a sale whose expenses would make its net proceeds negative", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        grossProceedsMinor: "0",
        feesMinor: "1",
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("rejects a stale version without creating a second operation", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({ ...sale(f), expectedPositionVersion: 1 })
    ).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
      version: 0,
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("replays the same sale without another operation or journal", async () => {
    const f = await setup()
    await useCase(f).execute(sale(f))
    expect(await useCase(f).execute(sale(f))).toMatchObject({
      ok: true,
      value: { operationId: "operation-2", journalEntryIds: ["entry-1"] },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
  })

  it("rejects changed content under a reused request id", async () => {
    const f = await setup()
    await useCase(f).execute(sale(f))
    expect(
      await useCase(f).execute({ ...sale(f), grossProceedsMinor: "501" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })

  it("preserves the supplied settlement date and sale audit snapshot", async () => {
    const f = await setup()
    await useCase(f).execute({ ...sale(f), settledOn: "2026-08-05" })
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({
      type: "SALE",
      settledOn: "2026-08-05",
      positionBefore: {
        kind: "EXISTING",
        quantity: "10",
        bookCostMinor: "1000",
        status: "OPEN",
      },
      bookCostDeltaMinor: "-400",
      grossAmountMinor: "500",
      netCashFlowMinor: "500",
    })
  })

  it("rejects a position from another book without persisting a receipt", async () => {
    const f = await setup()
    const other = await new CreateFinancialBook(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids
    ).execute({
      name: "Other",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
    if (!other.ok) throw new Error("fixture failed")
    expect(
      await useCase(f).execute({ ...sale(f), bookId: other.value.id })
    ).toMatchObject({ ok: false, error: { code: "BOOK_MISMATCH" } })
    expect(
      f.h.store.getInvestmentRequest(other.value.id as never, "sale-1")
    ).toBeUndefined()
  })

  it("rejects using the investment account as the external destination", async () => {
    const f = await setup()
    expect(
      await useCase(f).execute({
        ...sale(f),
        destination: { mode: "EXTERNAL_ACCOUNT", accountId: f.broker.id },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
  })
})
