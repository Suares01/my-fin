import {
  Currency,
  FinancialBook,
  InvestmentInstrument,
  InvestmentPosition,
  LedgerAccount,
  type InvestmentPositionSnapshot,
  investmentInstrumentIdFromString,
  investmentPositionIdFromString,
  ledgerAccountIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteInvestmentInstrumentRepository } from "../../src/repositories/sqlite-investment-instrument-repository.js"
import { SqliteInvestmentPositionRepository } from "../../src/repositories/sqlite-investment-position-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function positionSnapshot(
  overrides: Partial<InvestmentPositionSnapshot> = {}
): InvestmentPositionSnapshot {
  return {
    id: investmentPositionIdFromString("position-1"),
    bookId: "book-1" as never,
    investmentAccountId: ledgerAccountIdFromString("investment-1"),
    instrumentId: investmentInstrumentIdFromString("instrument-1"),
    label: "Reserva",
    normalizedLabel: "reserva",
    quantityMode: "UNITS",
    quantity: "10.5",
    bookCostMinor: "5000000000000000",
    currency: "BRL",
    openedOn: "2026-01-10",
    status: "OPEN",
    fixedIncomeTerms: {
      rateKind: "HYBRID",
      index: "CDI",
      indexPercentage: "105",
      annualSpreadRate: "1.25",
      issueDate: "2026-01-01",
      gracePeriodDate: "2026-02-01",
      maturityDate: "2030-01-01",
    },
    allocationRevision: 1,
    allocationEffectiveOn: "2026-01-10",
    version: 0,
    ...overrides,
  }
}

function position(
  overrides: Partial<InvestmentPositionSnapshot> = {}
): InvestmentPosition {
  return InvestmentPosition.restore(positionSnapshot(overrides))
}

function book(id = "book-1"): FinancialBook {
  return FinancialBook.create({
    id: id as never,
    name: id,
    baseCurrency: Currency.parse("BRL"),
    timezone: "America/Sao_Paulo",
  })
}

function investmentAccount(bookId = "book-1"): LedgerAccount {
  return LedgerAccount.restore({
    id: ledgerAccountIdFromString("investment-1"),
    bookId: bookId as never,
    name: "Carteira",
    normalizedName: "carteira",
    kind: "ASSET",
    status: "ACTIVE",
    financialAccount: { type: "INVESTMENT_ACCOUNT" },
    version: 0,
  })
}

function instrument(bookId = "book-1"): InvestmentInstrument {
  return InvestmentInstrument.restore({
    id: investmentInstrumentIdFromString("instrument-1"),
    bookId: bookId as never,
    name: "CDB Banco ABC",
    normalizedName: "cdb banco abc",
    type: "CDB",
    currency: "BRL",
    identifiers: [],
    status: "ACTIVE",
    version: 0,
  })
}

describe("SqliteInvestmentPositionRepository", () => {
  let database: BetterSqliteDatabase
  let repository: SqliteInvestmentPositionRepository

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    await new SqliteFinancialBookRepository(database).add(book())
    await new SqliteLedgerAccountRepository(database).add(investmentAccount())
    await new SqliteInvestmentInstrumentRepository(database).add(instrument())
    repository = new SqliteInvestmentPositionRepository(database)
  })

  afterEach(async () => database.close())

  it("returns NOT_FOUND for an absent position", async () => {
    await expect(
      repository.findById("book-1", investmentPositionIdFromString("missing"))
    ).resolves.toEqual({ kind: "NOT_FOUND" })
  })

  it("round-trips units, fixed-income terms, exact cost, and allocation revision", async () => {
    const value = position()
    await repository.add(value)

    const found = await repository.findById("book-1", value.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      value.toSnapshot()
    )
  })

  it("round-trips an amount position without quantity or fixed-income terms", async () => {
    const value = position({
      id: investmentPositionIdFromString("position-amount"),
      quantityMode: "AMOUNT",
      quantity: undefined,
      fixedIncomeTerms: undefined,
      bookCostMinor: "1000",
    })
    await repository.add(value)

    const found = await repository.findById("book-1", value.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      value.toSnapshot()
    )
  })

  it("returns BOOK_MISMATCH without exposing another book position", async () => {
    const value = position()
    await repository.add(value)
    await new SqliteFinancialBookRepository(database).add(book("book-2"))

    await expect(repository.findById("book-2", value.id)).resolves.toEqual({
      kind: "BOOK_MISMATCH",
    })
  })

  it("keeps two positions for the same account and instrument distinct", async () => {
    const first = position()
    const second = position({
      id: investmentPositionIdFromString("position-2"),
      label: "Viagem",
      normalizedLabel: "viagem",
    })
    await repository.add(first)
    await repository.add(second)

    expect(
      (await repository.findById("book-1", first.id)).kind
    ).toBe("FOUND")
    expect(
      (await repository.findById("book-1", second.id)).kind
    ).toBe("FOUND")
  })

  it("reports current and historical account usage independently", async () => {
    const open = position()
    const closed = position({
      id: investmentPositionIdFromString("position-closed"),
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
      closedOn: "2026-02-01",
    })
    await repository.add(open)
    await repository.add(closed)

    await expect(
      repository.hasAnyForAccount("book-1", open.toSnapshot().investmentAccountId)
    ).resolves.toBe(true)
    await expect(
      repository.hasOpenForAccount("book-1", open.toSnapshot().investmentAccountId)
    ).resolves.toBe(true)
  })

  it("reports historical instrument use after every position is closed", async () => {
    const closed = position({
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
      closedOn: "2026-02-01",
    })
    await repository.add(closed)

    await expect(
      repository.hasAnyForInstrument("book-1", closed.toSnapshot().instrumentId)
    ).resolves.toBe(true)
    await expect(
      repository.hasOpenForInstrument("book-1", closed.toSnapshot().instrumentId)
    ).resolves.toBe(false)
  })

  it("does not report use for the same account or instrument in another book", async () => {
    const value = position()
    await repository.add(value)
    await new SqliteFinancialBookRepository(database).add(book("book-2"))

    await expect(
      repository.hasAnyForAccount("book-2", value.toSnapshot().investmentAccountId)
    ).resolves.toBe(false)
    await expect(
      repository.hasAnyForInstrument("book-2", value.toSnapshot().instrumentId)
    ).resolves.toBe(false)
  })

  it("rejects adding a position that is not at version zero", async () => {
    await expect(repository.add(position({ version: 1 }))).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })

  it("saves the next aggregate version and its allocation state", async () => {
    const initial = position()
    await repository.add(initial)
    const updated = position({
      label: "Reserva atualizada",
      normalizedLabel: "reserva atualizada",
      quantity: "8.5",
      bookCostMinor: "4000000000000000",
      allocationRevision: 2,
      allocationEffectiveOn: "2026-02-01",
      version: 1,
    })

    await repository.save(updated, 0)

    const found = await repository.findById("book-1", updated.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      updated.toSnapshot()
    )
  })

  it("rejects a stale save and leaves the current position unchanged", async () => {
    const initial = position()
    await repository.add(initial)
    const current = position({ label: "Atual", normalizedLabel: "atual", version: 1 })
    await repository.save(current, 0)
    const stale = position({ label: "Antiga", normalizedLabel: "antiga", version: 1 })

    await expect(repository.save(stale, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const found = await repository.findById("book-1", initial.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      current.toSnapshot()
    )
  })

  it("rejects save attempts that alter immutable identity, mode, or terms", async () => {
    const initial = position()
    await repository.add(initial)
    const changed = position({
      instrumentId: investmentInstrumentIdFromString("instrument-2"),
      quantityMode: "AMOUNT",
      quantity: undefined,
      fixedIncomeTerms: undefined,
      version: 1,
    })

    await expect(repository.save(changed, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const found = await repository.findById("book-1", initial.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      initial.toSnapshot()
    )
  })

  it("rejects a persisted state whose closed status has no closing date", async () => {
    const value = position()
    await repository.add(value)
    await database.execute("PRAGMA ignore_check_constraints = ON")
    await database.execute(
      "UPDATE investment_positions SET status = 'CLOSED', closed_on = NULL WHERE id = ?",
      [value.id]
    )
    await database.execute("PRAGMA ignore_check_constraints = OFF")

    await expect(repository.findById("book-1", value.id)).rejects.toMatchObject({
      code: "INVALID_INVESTMENT_OPERATION",
    })
  })
})
