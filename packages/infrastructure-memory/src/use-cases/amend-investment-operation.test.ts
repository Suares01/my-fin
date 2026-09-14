import {
  AmendInvestmentOperation,
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentAmortization,
  RecordInvestmentExpense,
  RecordInvestmentIncome,
  RecordInvestmentPurchase,
  type RepositoryContext,
  type TransactionManager,
  RecordInvestmentSale,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await account(h, "Broker", "INVESTMENT_ACCOUNT")
  const gain = await category(h, "Gain", "INCOME")
  const expense = await category(h, "Expense", "EXPENSE")
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
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    occurredOn: "2026-08-04",
  })
  if (!opening.ok) throw new Error("fixture failed")
  return { h, broker, gain, expense }
}
async function account(
  h: ReturnType<typeof createHarness>,
  name: string,
  type: "INVESTMENT_ACCOUNT"
) {
  const result = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
async function category(
  h: ReturnType<typeof createHarness>,
  name: string,
  kind: "INCOME" | "EXPENSE"
) {
  const Command =
    kind === "INCOME" ? CreateIncomeCategory : CreateExpenseCategory
  const result = await new Command(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({
    bookId: "book-1",
    name,
    kind,
    iconKey: "chart",
    colorHex: "10b981",
  })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}
async function sale(f: Awaited<ReturnType<typeof setup>>, patch = {}) {
  return new RecordInvestmentSale(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "sale",
    positionId: "position-1",
    expectedPositionVersion: 0,
    type: "SALE",
    occurredOn: "2026-08-04",
    description: "Sale",
    currency: "BRL",
    quantityDelta: "4",
    bookCostReductionMinor: "400",
    grossProceedsMinor: "500",
    destination: { mode: "INTERNAL_CASH" },
    gainCategoryId: f.gain.id,
    ...patch,
  })
}
async function amend(f: Awaited<ReturnType<typeof setup>>, patch = {}) {
  return new AmendInvestmentOperation(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "amend",
    operationId: "operation-2",
    expectedOperationVersion: 0,
    expectedPositionVersion: 1,
    reason: "Correct sale",
    replacement: {
      bookId: "book-1",
      requestId: "replacement",
      positionId: "position-1",
      expectedPositionVersion: 1,
      type: "SALE",
      occurredOn: "2026-08-04",
      description: "Corrected sale",
      currency: "BRL",
      quantityDelta: "5",
      bookCostReductionMinor: "500",
      grossProceedsMinor: "600",
      destination: { mode: "INTERNAL_CASH" },
      gainCategoryId: f.gain.id,
    },
    ...patch,
  })
}

describe("AmendInvestmentOperation", () => {
  it("keeps the original, appends inverse and replacement operations, and applies only the replacement state", async () => {
    const f = await setup()
    await sale(f)
    expect(await amend(f)).toMatchObject({
      ok: true,
      value: {
        operationId: "operation-2",
        reversalOperationId: "operation-3",
        replacementOperationId: "operation-4",
        positionVersion: 2,
        allocationRevision: 3,
        journalEntryIds: ["entry-3", "entry-2"],
      },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "5",
      bookCostMinor: "500",
      status: "OPEN",
      version: 2,
      allocationRevision: 3,
    })
    expect(f.h.store.listInvestmentOperations()).toMatchObject([
      expect.objectContaining({ id: "operation-1" }),
      expect.objectContaining({
        id: "operation-2",
        replacedBy: "operation-4",
        version: 1,
      }),
      expect.objectContaining({
        id: "operation-3",
        role: "REVERSAL",
        reversalOf: "operation-2",
      }),
      expect.objectContaining({
        id: "operation-4",
        replacementOf: "operation-2",
        type: "SALE",
        quantityDelta: "-5",
        bookCostDeltaMinor: "-500",
      }),
    ])
  })

  it("keeps the journal-less lineage journal-less", async () => {
    const f = await setup()
    await sale(f, { grossProceedsMinor: "400", gainCategoryId: undefined })
    const result = await amend(f, {
      replacement: {
        ...(await amendment(f)),
        grossProceedsMinor: "500",
        bookCostReductionMinor: "500",
        gainCategoryId: undefined,
      },
    })
    expect(result).toMatchObject({ ok: true, value: { journalEntryIds: [] } })
    expect(f.h.store.listJournalEntries()).toEqual([])
  })

  it("creates only the replacement journal when the original had none", async () => {
    const f = await setup()
    await sale(f, { grossProceedsMinor: "400", gainCategoryId: undefined })
    expect(
      await amend(f, {
        replacement: {
          ...(await amendment(f)),
          grossProceedsMinor: "600",
          bookCostReductionMinor: "500",
          gainCategoryId: f.gain.id,
        },
      })
    ).toMatchObject({ ok: true, value: { journalEntryIds: ["entry-1"] } })
    expect(f.h.store.listJournalEntries()[0]).not.toHaveProperty(
      "replacementOf"
    )
  })

  it("reverses only the original journal when the replacement has no postings", async () => {
    const f = await setup()
    await sale(f)
    expect(
      await amend(f, {
        replacement: {
          ...(await amendment(f)),
          grossProceedsMinor: "500",
          bookCostReductionMinor: "500",
          gainCategoryId: undefined,
        },
      })
    ).toMatchObject({ ok: true, value: { journalEntryIds: ["entry-2"] } })
    expect(f.h.store.listJournalEntries()).toMatchObject([
      expect.objectContaining({ id: "entry-1", reversedBy: "entry-2" }),
      expect.objectContaining({ id: "entry-2", reversalOf: "entry-1" }),
    ])
  })

  it("rejects a replacement of another operation type without changing lineage", async () => {
    const f = await setup()
    await sale(f)
    expect(
      await amend(f, {
        replacement: { ...(await amendment(f)), type: "REDEMPTION" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
  })

  it("rejects a replacement for another position without changing the original", async () => {
    const f = await setup()
    await sale(f)
    expect(
      await amend(f, {
        replacement: { ...(await amendment(f)), positionId: "position-9" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()[1]).toMatchObject({
      version: 0,
    })
    expect(f.h.store.listInvestmentOperations()[1]).not.toHaveProperty(
      "replacedBy"
    )
  })

  it("rejects a currency change before persisting journals", async () => {
    const f = await setup()
    await sale(f)
    expect(
      await amend(f, {
        replacement: { ...(await amendment(f)), currency: "USD" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listJournalEntries()).toHaveLength(1)
  })

  it("rejects a date after the book-local current day", async () => {
    const f = await setup()
    await sale(f)
    expect(
      await amend(f, {
        replacement: { ...(await amendment(f)), occurredOn: "2026-08-05" },
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_INVESTMENT_OPERATION" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
  })

  it("rejects a stale operation version before an amendment", async () => {
    const f = await setup()
    await sale(f)
    expect(await amend(f, { expectedOperationVersion: 1 })).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({ version: 1 })
  })

  it("rejects a stale position version before an amendment", async () => {
    const f = await setup()
    await sale(f)
    expect(await amend(f, { expectedPositionVersion: 0 })).toMatchObject({
      ok: false,
      error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
  })

  it("replays the same amendment without extra operations or journals", async () => {
    const f = await setup()
    await sale(f)
    const first = await amend(f)
    const second = await amend(f)
    expect(second).toEqual(first)
    expect(f.h.store.listInvestmentOperations()).toHaveLength(4)
    expect(f.h.store.listJournalEntries()).toHaveLength(3)
  })

  it("rejects changed content under a confirmed amendment request id", async () => {
    const f = await setup()
    await sale(f)
    await amend(f)
    expect(await amend(f, { reason: "Other correction" })).toMatchObject({
      ok: false,
      error: { code: "IDEMPOTENCY_CONFLICT" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(4)
  })

  it("rejects a target that is no longer effective", async () => {
    const f = await setup()
    await sale(f)
    await amend(f)
    expect(
      await amend(f, {
        requestId: "amend-2",
        expectedOperationVersion: 1,
        expectedPositionVersion: 2,
      })
    ).toMatchObject({
      ok: false,
      error: { code: "INVESTMENT_OPERATION_NOT_CORRECTABLE" },
    })
  })

  it("amends a purchase through the same append-only lineage", async () => {
    const f = await setup()
    const recorded = await new RecordInvestmentPurchase(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      requestId: "purchase",
      positionId: "position-1",
      expectedPositionVersion: 0,
      type: "PURCHASE",
      occurredOn: "2026-08-04",
      description: "Purchase",
      currency: "BRL",
      quantityDelta: "1",
      capitalMinor: "100",
      funding: { mode: "INTERNAL_CASH" },
    })
    expect(recorded).toMatchObject({ ok: true })
    expect(
      await amend(f, {
        replacement: {
          bookId: "book-1",
          requestId: "replacement",
          positionId: "position-1",
          expectedPositionVersion: 1,
          type: "PURCHASE",
          occurredOn: "2026-08-04",
          description: "Corrected purchase",
          currency: "BRL",
          quantityDelta: "2",
          capitalMinor: "200",
          funding: { mode: "INTERNAL_CASH" },
        },
      })
    ).toMatchObject({
      ok: true,
      value: { replacementOperationId: "operation-4" },
    })
    expect(f.h.store.listInvestmentOperations()[3]).toMatchObject({
      type: "PURCHASE",
      quantityDelta: "2",
      bookCostDeltaMinor: "200",
    })
  })

  it("amends income without changing position allocation", async () => {
    const f = await setup()
    const recorded = await new RecordInvestmentIncome(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      requestId: "income",
      positionId: "position-1",
      expectedPositionVersion: 0,
      type: "INCOME",
      occurredOn: "2026-08-04",
      description: "Income",
      currency: "BRL",
      grossAmountMinor: "10",
      incomeCategoryId: f.gain.id,
      cashMode: "INTERNAL_CASH",
    })
    expect(recorded).toMatchObject({ ok: true })
    expect(
      await amend(f, {
        replacement: {
          bookId: "book-1",
          requestId: "replacement",
          positionId: "position-1",
          expectedPositionVersion: 1,
          type: "INCOME",
          occurredOn: "2026-08-04",
          description: "Corrected income",
          currency: "BRL",
          grossAmountMinor: "20",
          incomeCategoryId: f.gain.id,
          cashMode: "INTERNAL_CASH",
        },
      })
    ).toMatchObject({
      ok: true,
      value: { replacementOperationId: "operation-4" },
    })
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "10",
      bookCostMinor: "1000",
      allocationRevision: 1,
    })
  })

  it("amends amortization through its current accounting plan", async () => {
    const f = await setup()
    const recorded = await new RecordInvestmentAmortization(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      requestId: "amortization",
      positionId: "position-1",
      expectedPositionVersion: 0,
      type: "AMORTIZATION",
      occurredOn: "2026-08-04",
      description: "Amortization",
      currency: "BRL",
      bookCostReductionMinor: "100",
      grossProceedsMinor: "110",
      gainCategoryId: f.gain.id,
      cashMode: "INTERNAL_CASH",
    })
    expect(recorded).toMatchObject({ ok: true })
    const result = await amend(f, {
      replacement: {
        bookId: "book-1",
        requestId: "replacement",
        positionId: "position-1",
        expectedPositionVersion: 1,
        type: "AMORTIZATION",
        occurredOn: "2026-08-04",
        description: "Corrected amortization",
        currency: "BRL",
        bookCostReductionMinor: "200",
        grossProceedsMinor: "220",
        gainCategoryId: f.gain.id,
        cashMode: "INTERNAL_CASH",
      },
    })
    expect(result).toMatchObject({
      ok: true,
      value: { replacementOperationId: "operation-4" },
    })
    expect(f.h.store.listInvestmentOperations()[3]).toMatchObject({
      type: "AMORTIZATION",
      bookCostDeltaMinor: "-200",
    })
  })

  it("amends a fee without duplicating a second auxiliary expense", async () => {
    const f = await setup()
    const recorded = await new RecordInvestmentExpense(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      requestId: "fee",
      positionId: "position-1",
      expectedPositionVersion: 0,
      type: "FEE",
      occurredOn: "2026-08-04",
      description: "Fee",
      currency: "BRL",
      amountMinor: "10",
      expenseCategoryId: f.expense.id,
      cashMode: "INTERNAL_CASH",
    })
    expect(recorded).toMatchObject({ ok: true })
    expect(
      await amend(f, {
        replacement: {
          bookId: "book-1",
          requestId: "replacement",
          positionId: "position-1",
          expectedPositionVersion: 1,
          type: "FEE",
          occurredOn: "2026-08-04",
          description: "Corrected fee",
          currency: "BRL",
          amountMinor: "20",
          expenseCategoryId: f.expense.id,
          cashMode: "INTERNAL_CASH",
        },
      })
    ).toMatchObject({
      ok: true,
      value: { replacementOperationId: "operation-4" },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(4)
  })

  it.each([
    ["a zero unit reduction", { quantityDelta: "0" }],
    ["a negative unit reduction", { quantityDelta: "-1" }],
    ["a non-numeric cost reduction", { bookCostReductionMinor: "x" }],
    [
      "net proceeds below fees",
      { grossProceedsMinor: "10", feesMinor: "11", feeCategoryId: "account-6" },
    ],
    ["a required gain category omitted", { gainCategoryId: undefined }],
    ["a malformed occurrence date", { occurredOn: "04-08-2026" }],
    ["a stale current-day boundary", { occurredOn: "2026-08-05" }],
  ])("rejects %s without a partial replacement", async (_name, patch) => {
    const f = await setup()
    await sale(f)
    expect(
      await amend(f, {
        replacement: { ...(await amendment(f)), ...patch } as never,
      })
    ).toMatchObject({ ok: false, error: { code: expect.any(String) } })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
    expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
      quantity: "6",
      bookCostMinor: "600",
      version: 1,
    })
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "rolls back every amendment write boundary (%i) without orphaned lineage",
    async (failAfter) => {
      const f = await setup()
      await sale(f)
      const result = await new AmendInvestmentOperation(
        failingManager(f.h.transactionManager, failAfter),
        f.h.dispatcher,
        f.h.ids,
        f.h.clock
      ).execute(amendmentCommand(f))
      expect(result).toMatchObject({
        ok: false,
        error: { code: "UNEXPECTED_ERROR" },
      })
      expect(f.h.store.listInvestmentPositions()[0]).toMatchObject({
        quantity: "6",
        bookCostMinor: "600",
        version: 1,
      })
      expect(f.h.store.listInvestmentOperations()).toHaveLength(2)
      expect(f.h.store.listInvestmentOperations()[1]).not.toHaveProperty(
        "replacedBy"
      )
      expect(f.h.store.listJournalEntries()).toMatchObject([
        expect.objectContaining({ id: "entry-1", version: 0 }),
      ])
    }
  )
})

async function amendment(f: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1",
    requestId: "replacement",
    positionId: "position-1",
    expectedPositionVersion: 1,
    type: "SALE" as const,
    occurredOn: "2026-08-04",
    description: "Corrected sale",
    currency: "BRL",
    quantityDelta: "5",
    bookCostReductionMinor: "500",
    grossProceedsMinor: "600",
    destination: { mode: "INTERNAL_CASH" as const },
    gainCategoryId: f.gain.id,
  }
}

function amendmentCommand(f: Awaited<ReturnType<typeof setup>>) {
  return {
    bookId: "book-1",
    requestId: "amend",
    operationId: "operation-2",
    expectedOperationVersion: 0,
    expectedPositionVersion: 1,
    reason: "Correct sale",
    replacement: {
      bookId: "book-1",
      requestId: "replacement",
      positionId: "position-1",
      expectedPositionVersion: 1,
      type: "SALE" as const,
      occurredOn: "2026-08-04",
      description: "Corrected sale",
      currency: "BRL",
      quantityDelta: "5",
      bookCostReductionMinor: "500",
      grossProceedsMinor: "600",
      destination: { mode: "INTERNAL_CASH" as const },
      gainCategoryId: f.gain.id,
    },
  }
}

function failingManager(
  base: TransactionManager,
  failAfter: number
): TransactionManager {
  return {
    execute: async <T>(work: (repositories: RepositoryContext) => Promise<T>) =>
      base.execute(async (repositories) => {
        let writes = 0
        const write = async <T>(operation: () => Promise<T>) => {
          const value = await operation()
          writes += 1
          if (writes === failAfter)
            throw new Error("forced persistence failure")
          return value
        }
        return work({
          ...repositories,
          journalEntries: {
            ...repositories.journalEntries,
            add: (value) => write(() => repositories.journalEntries.add(value)),
            save: (value, version) =>
              write(() => repositories.journalEntries.save(value, version)),
          },
          investmentOperations: {
            ...repositories.investmentOperations,
            add: (value) =>
              write(() => repositories.investmentOperations.add(value)),
            saveLineage: (value, version) =>
              write(() =>
                repositories.investmentOperations.saveLineage(value, version)
              ),
          },
          investmentPositions: {
            ...repositories.investmentPositions,
            save: (value, version) =>
              write(() =>
                repositories.investmentPositions.save(value, version)
              ),
          },
          investmentRequests: {
            ...repositories.investmentRequests,
            add: (value) =>
              write(() => repositories.investmentRequests.add(value)),
          },
        })
      }),
  }
}
