import {
  AmendInvestmentOperation,
  AmendJournalEntry,
  CreateFinancialAccount,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordInvestmentSale,
  ReverseInvestmentOperation,
  ReverseJournalEntry,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

type Fixture = Awaited<ReturnType<typeof setup>>

async function setup() {
  const h = createHarness()
  await createBook(h)
  const broker = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "Broker", type: "INVESTMENT_ACCOUNT" })
  const gain = await new CreateIncomeCategory(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({
    bookId: "book-1",
    name: "Gain",
    kind: "INCOME",
    iconKey: "chart",
    colorHex: "10b981",
  })
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!broker.ok || !gain.ok || !instrument.ok)
    throw new Error("fixture failed")
  const opening = await new OpenInvestmentPosition(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  ).execute({
    bookId: "book-1",
    requestId: "open",
    investmentAccountId: broker.value.id,
    instrumentId: instrument.value.id,
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    occurredOn: "2026-08-04",
  })
  if (!opening.ok) throw new Error("fixture failed")
  return { h, gain: gain.value }
}

async function sale(f: Fixture) {
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
  })
}

async function reversed() {
  const f = await setup()
  await sale(f)
  const result = await new ReverseInvestmentOperation(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "reverse-investment",
    operationId: "operation-2",
    expectedOperationVersion: 0,
    expectedPositionVersion: 1,
    reason: "Correct sale",
  })
  if (!result.ok) throw new Error("fixture failed")
  f.h.publisher.clear()
  return f
}

async function amended() {
  const f = await setup()
  await sale(f)
  const result = await new AmendInvestmentOperation(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    requestId: "amend-investment",
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
  })
  if (!result.ok) throw new Error("fixture failed")
  f.h.publisher.clear()
  return f
}

function reverseGeneric(
  f: Fixture,
  journalEntryId: string,
  expectedVersion = 0
) {
  return new ReverseJournalEntry(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    journalEntryId,
    expectedVersion,
    occurredOn: "2026-08-04",
    description: "Generic correction",
  })
}

function amendGeneric(f: Fixture, journalEntryId: string, expectedVersion = 0) {
  return new AmendJournalEntry(
    f.h.transactionManager,
    f.h.dispatcher,
    f.h.ids,
    f.h.clock
  ).execute({
    bookId: "book-1",
    journalEntryId,
    expectedVersion,
    replacement: {
      type: "TRANSFER",
      sourceAccountId: "missing",
      destinationAccountId: "missing",
      amountMinor: "1",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Generic correction",
    },
  })
}

function expectBlocked(
  f: Fixture,
  result:
    | Awaited<ReturnType<typeof reverseGeneric>>
    | Awaited<ReturnType<typeof amendGeneric>>,
  before: ReturnType<Fixture["h"]["store"]["snapshot"]>
) {
  expect(result).toMatchObject({
    ok: false,
    error: { code: "INVESTMENT_OPERATION_REQUIRED" },
  })
  expect(f.h.store.snapshot()).toEqual(before)
  expect(f.h.publisher.events).toEqual([])
}

describe("investment journal ownership guard", () => {
  it.each([
    ["original", "entry-1"],
    ["reversal", "entry-2"],
  ] as const)(
    "blocks generic reverse of an investment %s journal",
    async (_kind, id) => {
      const f = await reversed()
      const before = f.h.store.snapshot()
      expectBlocked(f, await reverseGeneric(f, id), before)
    }
  )

  it.each([
    ["original", "entry-1", 1],
    ["reversal", "entry-2", 0],
    ["replacement", "entry-3", 0],
  ] as const)(
    "blocks generic reverse of amended investment %s journal",
    async (_kind, id, version) => {
      const f = await amended()
      const before = f.h.store.snapshot()
      expectBlocked(f, await reverseGeneric(f, id, version), before)
    }
  )

  it.each([
    ["original", "entry-1", 1],
    ["reversal", "entry-2", 0],
  ] as const)(
    "blocks generic amendment of reversed investment %s journal",
    async (_kind, id, version) => {
      const f = await reversed()
      const before = f.h.store.snapshot()
      expectBlocked(f, await amendGeneric(f, id, version), before)
    }
  )

  it.each([
    ["original", "entry-1", 1],
    ["reversal", "entry-2", 0],
    ["replacement", "entry-3", 0],
  ] as const)(
    "blocks generic amendment of amended investment %s journal",
    async (_kind, id, version) => {
      const f = await amended()
      const before = f.h.store.snapshot()
      expectBlocked(f, await amendGeneric(f, id, version), before)
    }
  )

  it("finds the operation owning original, reversal and replacement journals", async () => {
    const f = await amended()
    const owners = await f.h.transactionManager.execute(async (repositories) =>
      Promise.all(
        ["entry-1", "entry-2", "entry-3"].map((id) =>
          repositories.investmentOperations.findOwnerOfJournal(
            "book-1",
            id as never
          )
        )
      )
    )
    expect(owners.value.map((owner) => owner?.id)).toEqual([
      "operation-2",
      "operation-4",
      "operation-3",
    ])
  })

  it("does not assign ownership to an investment operation without a journal", async () => {
    const f = await setup()
    const owner = await f.h.transactionManager.execute((repositories) =>
      repositories.investmentOperations.findOwnerOfJournal(
        "book-1",
        "entry-1" as never
      )
    )
    expect(owner.value).toBeNull()
  })
})
