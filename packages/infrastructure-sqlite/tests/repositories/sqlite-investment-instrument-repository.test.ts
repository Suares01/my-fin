import {
  Currency,
  FinancialBook,
  InvestmentInstrument,
  type InvestmentInstrumentSnapshot,
  investmentInstrumentIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteInvestmentInstrumentRepository } from "../../src/repositories/sqlite-investment-instrument-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function book(id = "book-1"): FinancialBook {
  return FinancialBook.create({
    id: id as never,
    name: id,
    baseCurrency: Currency.parse("BRL"),
    timezone: "America/Sao_Paulo",
  })
}

function instrumentSnapshot(
  overrides: Partial<InvestmentInstrumentSnapshot> = {}
): InvestmentInstrumentSnapshot {
  return {
    id: investmentInstrumentIdFromString("instrument-1"),
    bookId: "book-1" as never,
    name: "CDB Banco ABC",
    normalizedName: "cdb banco abc",
    type: "CDB",
    currency: "BRL",
    identifiers: [],
    status: "ACTIVE",
    version: 0,
    ...overrides,
  }
}

function instrument(
  overrides: Partial<InvestmentInstrumentSnapshot> = {}
): InvestmentInstrument {
  return InvestmentInstrument.restore(instrumentSnapshot(overrides))
}

describe("SqliteInvestmentInstrumentRepository", () => {
  let database: BetterSqliteDatabase
  let repository: SqliteInvestmentInstrumentRepository
  let books: SqliteFinancialBookRepository

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    repository = new SqliteInvestmentInstrumentRepository(database)
    books = new SqliteFinancialBookRepository(database)
    await books.add(book())
  })

  afterEach(async () => database.close())

  it("returns NOT_FOUND for an absent instrument", async () => {
    await expect(
      repository.findById("book-1", investmentInstrumentIdFromString("missing"))
    ).resolves.toEqual({ kind: "NOT_FOUND" })
  })

  it("round-trips every scalar field and identifiers", async () => {
    const value = instrument({
      issuerName: "Banco ABC",
      identifiers: [
        { scheme: "TICKER", value: "cdbx", market: "b3" },
        { scheme: "ISIN", value: "brabc123" },
        { scheme: "OTHER", value: " internal  42 " },
      ],
    })
    await repository.add(value)

    const found = await repository.findById("book-1", value.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      value.toSnapshot()
    )
  })

  it("returns BOOK_MISMATCH without exposing another book entity", async () => {
    const value = instrument()
    await repository.add(value)
    await books.add(book("book-2"))

    await expect(repository.findById("book-2", value.id)).resolves.toEqual({
      kind: "BOOK_MISMATCH",
    })
  })

  it("keeps names non-unique within a book", async () => {
    await repository.add(instrument())
    const duplicateName = instrument({
      id: investmentInstrumentIdFromString("instrument-2"),
    })

    await expect(repository.add(duplicateName)).resolves.toBeUndefined()
  })

  it("finds a normalized ticker identifier", async () => {
    await repository.add(
      instrument({
        identifiers: [{ scheme: "TICKER", value: "petr4", market: "b3" }],
      })
    )

    await expect(
      repository.existsWithIdentifier("book-1", {
        scheme: "TICKER",
        value: " PETR4 ",
        market: " B3 ",
      })
    ).resolves.toBe(true)
  })

  it("finds an ISIN without a market", async () => {
    await repository.add(
      instrument({ identifiers: [{ scheme: "ISIN", value: "brabc123" }] })
    )

    await expect(
      repository.existsWithIdentifier("book-1", {
        scheme: "ISIN",
        value: "BRABC123",
      })
    ).resolves.toBe(true)
  })

  it("does not find an identifier in another book", async () => {
    await repository.add(
      instrument({ identifiers: [{ scheme: "ISIN", value: "BRABC123" }] })
    )
    await books.add(book("book-2"))

    await expect(
      repository.existsWithIdentifier("book-2", {
        scheme: "ISIN",
        value: "BRABC123",
      })
    ).resolves.toBe(false)
  })

  it("excludes the current instrument from identifier uniqueness", async () => {
    const value = instrument({
      identifiers: [{ scheme: "ISIN", value: "BRABC123" }],
    })
    await repository.add(value)

    await expect(
      repository.existsWithIdentifier(
        "book-1",
        { scheme: "ISIN", value: "BRABC123" },
        value.id
      )
    ).resolves.toBe(false)
  })

  it("keeps the persisted instrument unchanged after a metadata no-op", async () => {
    const value = instrument({
      identifiers: [{ scheme: "ISIN", value: "BRABC123" }],
    })
    await repository.add(value)

    value.updateMetadata({
      name: "CDB Banco ABC",
      identifiers: [{ scheme: "ISIN", value: "BRABC123" }],
    })

    expect(value.version).toBe(0)
    const found = await repository.findById("book-1", value.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      value.toSnapshot()
    )
  })

  it("rejects a duplicate normalized identifier without persisting the second instrument", async () => {
    await repository.add(
      instrument({ identifiers: [{ scheme: "ISIN", value: "BRABC123" }] })
    )
    const duplicate = instrument({
      id: investmentInstrumentIdFromString("instrument-2"),
      identifiers: [{ scheme: "ISIN", value: "BRABC123" }],
    })

    await expect(
      database.transaction((executor) =>
        new SqliteInvestmentInstrumentRepository(executor).add(duplicate)
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
    await expect(repository.findById("book-1", duplicate.id)).resolves.toEqual({
      kind: "NOT_FOUND",
    })
  })

  it("saves scalar changes and replaces identifier children", async () => {
    const initial = instrument({
      identifiers: [{ scheme: "ISIN", value: "BRABC123" }],
    })
    const updated = instrument({
      name: "CDB Atualizado",
      normalizedName: "cdb atualizado",
      issuerName: "Banco Novo",
      identifiers: [{ scheme: "TICKER", value: "cdbx", market: "b3" }],
      version: 1,
    })
    await repository.add(initial)

    await repository.save(updated, 0)

    const found = await repository.findById("book-1", updated.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      updated.toSnapshot()
    )
    await expect(
      repository.existsWithIdentifier("book-1", {
        scheme: "ISIN",
        value: "BRABC123",
      })
    ).resolves.toBe(false)
  })

  it("rejects a stale save and keeps identifier children unchanged", async () => {
    const initial = instrument({
      identifiers: [{ scheme: "ISIN", value: "BRABC123" }],
    })
    await repository.add(initial)
    const current = instrument({
      identifiers: [{ scheme: "TICKER", value: "cdbx", market: "b3" }],
      version: 1,
    })
    await repository.save(current, 0)
    const stale = instrument({
      identifiers: [{ scheme: "OTHER", value: "stale" }],
      version: 1,
    })

    await expect(repository.save(stale, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const found = await repository.findById("book-1", initial.id)
    expect(found.kind === "FOUND" ? found.value.toSnapshot() : null).toEqual(
      current.toSnapshot()
    )
  })

  it("rejects a save whose next version is not exactly one increment", async () => {
    const value = instrument({ version: 2 })

    await expect(repository.save(value, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
  })
})
