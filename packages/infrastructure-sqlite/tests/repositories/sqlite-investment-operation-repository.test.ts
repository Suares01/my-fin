import {
  Currency,
  FinancialBook,
  InvestmentInstrument,
  InvestmentOperation,
  InvestmentPosition,
  LedgerAccount,
  type InvestmentOperationSnapshot,
  investmentInstrumentIdFromString,
  investmentOperationIdFromString,
  investmentPositionIdFromString,
  ledgerAccountIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteInvestmentInstrumentRepository } from "../../src/repositories/sqlite-investment-instrument-repository.js"
import { SqliteInvestmentOperationRepository } from "../../src/repositories/sqlite-investment-operation-repository.js"
import { SqliteInvestmentPositionRepository } from "../../src/repositories/sqlite-investment-position-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function operationSnapshot(
  overrides: Partial<InvestmentOperationSnapshot> = {}
): InvestmentOperationSnapshot {
  return {
    id: investmentOperationIdFromString("operation-1"),
    bookId: "book-1" as never,
    positionId: investmentPositionIdFromString("position-1"),
    type: "SALE",
    role: "BUSINESS",
    occurredOn: "2026-01-02",
    recordedAt: "2026-01-02T12:00:00.000Z",
    sequence: "2",
    description: "Venda",
    currency: "BRL",
    quantityDelta: "-4",
    bookCostDeltaMinor: "-400",
    grossAmountMinor: "500",
    feesMinor: "10",
    taxesMinor: "20",
    netCashFlowMinor: "470",
    cashMode: "INTERNAL_CASH",
    categories: { gainCategoryId: "income-1", feeCategoryId: "expense-1" },
    positionBefore: {
      kind: "EXISTING",
      quantity: "10",
      bookCostMinor: "1000",
      status: "OPEN",
      openedOn: "2026-01-01",
      allocationEffectiveOn: "2026-01-01",
    },
    version: 0,
    ...overrides,
  }
}
function operation(
  overrides: Partial<InvestmentOperationSnapshot> = {}
): InvestmentOperation {
  return InvestmentOperation.restore(operationSnapshot(overrides))
}
function book(id = "book-1"): FinancialBook {
  return FinancialBook.create({
    id: id as never,
    name: id,
    baseCurrency: Currency.parse("BRL"),
    timezone: "America/Sao_Paulo",
  })
}
function account(): LedgerAccount {
  return LedgerAccount.restore({
    id: ledgerAccountIdFromString("investment-1"),
    bookId: "book-1" as never,
    name: "Carteira",
    normalizedName: "carteira",
    kind: "ASSET",
    status: "ACTIVE",
    financialAccount: { type: "INVESTMENT_ACCOUNT" },
    version: 0,
  })
}
function instrument(): InvestmentInstrument {
  return InvestmentInstrument.restore({
    id: investmentInstrumentIdFromString("instrument-1"),
    bookId: "book-1" as never,
    name: "CDB",
    normalizedName: "cdb",
    type: "CDB",
    currency: "BRL",
    identifiers: [],
    status: "ACTIVE",
    version: 0,
  })
}
function position(): InvestmentPosition {
  return InvestmentPosition.restore({
    id: investmentPositionIdFromString("position-1"),
    bookId: "book-1" as never,
    investmentAccountId: ledgerAccountIdFromString("investment-1"),
    instrumentId: investmentInstrumentIdFromString("instrument-1"),
    normalizedLabel: "",
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    currency: "BRL",
    openedOn: "2026-01-01",
    status: "OPEN",
    allocationRevision: 1,
    allocationEffectiveOn: "2026-01-01",
    version: 0,
  })
}

describe("SqliteInvestmentOperationRepository", () => {
  let database: BetterSqliteDatabase
  let repository: SqliteInvestmentOperationRepository
  let journalSequence: number
  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    journalSequence = 100
    await new SqliteFinancialBookRepository(database).add(book())
    await new SqliteLedgerAccountRepository(database).add(account())
    await new SqliteInvestmentInstrumentRepository(database).add(instrument())
    await new SqliteInvestmentPositionRepository(database).add(position())
    repository = new SqliteInvestmentOperationRepository(database)
  })
  afterEach(async () => database.close())

  it("returns NOT_FOUND for an absent operation", async () => {
    await expect(
      repository.findById("book-1", investmentOperationIdFromString("missing"))
    ).resolves.toEqual({ kind: "NOT_FOUND" })
  })
  it("round-trips every authoritative effect, category, state, and journal reference", async () => {
    const value = operation({
      journalEntryId: "journal-1" as never,
      settledOn: "2026-01-03",
    })
    await journal("journal-1")
    await repository.add(value)
    const found = await repository.findById("book-1", value.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      value.toSnapshot()
    )
  })
  it("round-trips an unopened operation with absent optional fields", async () => {
    const value = operation({
      id: investmentOperationIdFromString("opening-1"),
      type: "OPENING_ALLOCATION",
      occurredOn: "2026-01-01",
      recordedAt: "2026-01-01T12:00:00.000Z",
      sequence: "1",
      quantityDelta: "10",
      bookCostDeltaMinor: "1000",
      grossAmountMinor: "0",
      netCashFlowMinor: "0",
      cashMode: "NONE",
      categories: {},
      positionBefore: { kind: "UNOPENED" },
    })
    await repository.add(value)
    const found = await repository.findById("book-1", value.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      value.toSnapshot()
    )
  })
  it("returns BOOK_MISMATCH without exposing another book operation", async () => {
    const value = operation()
    await repository.add(value)
    await new SqliteFinancialBookRepository(database).add(book("book-2"))
    await expect(repository.findById("book-2", value.id)).resolves.toEqual({
      kind: "BOOK_MISMATCH",
    })
  })
  it("rejects add outside version zero", async () => {
    await expect(
      repository.add(operation({ version: 1 }))
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
  })
  it("orders the last effective operation by date and persisted sequence", async () => {
    await repository.add(
      operation({
        id: investmentOperationIdFromString("older"),
        occurredOn: "2026-01-01",
        sequence: "1",
      })
    )
    await repository.add(
      operation({
        id: investmentOperationIdFromString("later"),
        occurredOn: "2026-01-03",
        sequence: "3",
      })
    )
    await expect(
      repository.findLastEffective(
        "book-1",
        investmentPositionIdFromString("position-1")
      )
    ).resolves.toMatchObject({ id: "later" })
  })
  it("orders same-day effective operations by sequence", async () => {
    await repository.add(
      operation({ id: investmentOperationIdFromString("first"), sequence: "1" })
    )
    await repository.add(
      operation({
        id: investmentOperationIdFromString("second"),
        sequence: "3",
      })
    )
    await expect(
      repository.findLastEffective(
        "book-1",
        investmentPositionIdFromString("position-1")
      )
    ).resolves.toMatchObject({ id: "second" })
  })
  it("excludes the correction target from last effective lookup", async () => {
    const first = operation({
      id: investmentOperationIdFromString("first"),
      sequence: "1",
    })
    const target = operation({
      id: investmentOperationIdFromString("target"),
      sequence: "3",
    })
    await repository.add(first)
    await repository.add(target)
    await expect(
      repository.findLastEffective(
        "book-1",
        target.toSnapshot().positionId,
        target.id
      )
    ).resolves.toMatchObject({ id: "first" })
  })
  it("does not treat a reversed business operation as effective", async () => {
    const original = operation()
    await repository.add(original)
    const reversal = InvestmentOperation.createReversal({
      id: investmentOperationIdFromString("reversal"),
      original: original.toSnapshot(),
      recordedAt: "2026-02-01T12:00:00.000Z",
      sequence: "3",
    })
    await repository.add(reversal)
    original.markReversedBy(reversal.id)
    await repository.saveLineage(original, 0)
    await expect(
      repository.findLastEffective("book-1", original.toSnapshot().positionId)
    ).resolves.toBeNull()
  })
  it("replaces an original in the effective ordering", async () => {
    const original = operation()
    await repository.add(original)
    const replacement = operation({
      id: investmentOperationIdFromString("replacement"),
      sequence: "3",
    })
    await repository.add(replacement)
    original.markReplacedBy(replacement.id)
    await repository.saveLineage(original, 0)
    await expect(
      repository.findLastEffective("book-1", original.toSnapshot().positionId)
    ).resolves.toMatchObject({ id: "replacement" })
  })
  it("saves lineage without rewriting authoritative effects", async () => {
    const original = operation()
    await repository.add(original)
    const reversal = InvestmentOperation.createReversal({
      id: investmentOperationIdFromString("reversal"),
      original: original.toSnapshot(),
      recordedAt: "2026-02-01T12:00:00.000Z",
      sequence: "3",
    })
    await repository.add(reversal)
    original.markReversedBy(reversal.id)
    await repository.saveLineage(original, 0)
    const found = await repository.findById("book-1", original.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      original.toSnapshot()
    )
  })
  it("rejects stale lineage and retains the persisted link", async () => {
    const original = operation()
    await repository.add(original)
    const reversal = InvestmentOperation.createReversal({
      id: investmentOperationIdFromString("reversal"),
      original: original.toSnapshot(),
      recordedAt: "2026-02-01T12:00:00.000Z",
      sequence: "3",
    })
    await repository.add(reversal)
    original.markReversedBy(reversal.id)
    await repository.saveLineage(original, 0)
    const stale = operation({
      reversedBy: investmentOperationIdFromString("other"),
      version: 1,
    })
    await expect(repository.saveLineage(stale, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const found = await repository.findById("book-1", original.id)
    expect(
      found.kind === "FOUND" ? found.value.toSnapshot().reversedBy : null
    ).toBe("reversal")
  })
  it.each([
    [undefined, undefined],
    ["journal-original", undefined],
    [undefined, "journal-reversal"],
    ["journal-original", "journal-reversal"],
  ] as const)(
    "preserves journal ownership for original %s and reversal %s",
    async (originalJournal, reversalJournal) => {
      if (originalJournal) await journal(originalJournal)
      if (reversalJournal) await journal(reversalJournal)
      const original = operation({
        id: investmentOperationIdFromString(
          `original-${originalJournal ?? "none"}-${reversalJournal ?? "none"}`
        ),
        sequence:
          originalJournal === undefined && reversalJournal === undefined
            ? "2"
            : originalJournal === undefined
              ? "3"
              : "4",
        journalEntryId: originalJournal as never,
      })
      await repository.add(original)
      const reversal = operation({
        id: investmentOperationIdFromString(
          `reversal-${originalJournal ?? "none"}-${reversalJournal ?? "none"}`
        ),
        role: "REVERSAL",
        reversalOf: original.id,
        recordedAt: "2026-02-01T12:00:00.000Z",
        sequence:
          originalJournal === undefined && reversalJournal === undefined
            ? "5"
            : originalJournal === undefined
              ? "6"
              : originalJournal === "journal-original" &&
                  reversalJournal === undefined
                ? "7"
                : "8",
        ...(reversalJournal === undefined
          ? { journalEntryId: undefined }
          : { journalEntryId: reversalJournal as never }),
      })
      await repository.add(reversal)
      expect(
        (await repository.findById("book-1", original.id)).kind === "FOUND"
          ? (
              (await repository.findById("book-1", original.id)) as {
                value: InvestmentOperation
              }
            ).value.toSnapshot().journalEntryId
          : null
      ).toBe(originalJournal)
      expect(
        (await repository.findById("book-1", reversal.id)).kind === "FOUND"
          ? (
              (await repository.findById("book-1", reversal.id)) as {
                value: InvestmentOperation
              }
            ).value.toSnapshot().journalEntryId
          : null
      ).toBe(reversalJournal)
    }
  )

  async function journal(id: string): Promise<void> {
    journalSequence += 1
    await database.execute(
      "INSERT INTO journal_entries (id, book_id, occurred_on, recorded_at, sequence, description, currency, origin, version) VALUES (?, 'book-1', '2026-01-01', '2026-01-01T00:00:00.000Z', ?, 'journal', 'BRL', 'MANUAL', 0)",
      [id, String(journalSequence)]
    )
  }
})
