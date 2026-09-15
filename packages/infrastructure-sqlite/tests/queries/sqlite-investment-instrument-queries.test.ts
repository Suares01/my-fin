import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentInstrumentQueries } from "../../src/queries/investments/sqlite-investment-instrument-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

describe("SqliteInvestmentInstrumentQueries", () => {
  let database: BetterSqliteDatabase
  let queries: SqliteInvestmentInstrumentQueries
  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute(
      "INSERT INTO financial_books (id,name,base_currency,timezone,version) VALUES ('book-1','Book','BRL','UTC',0)"
    )
    queries = new SqliteInvestmentInstrumentQueries(database)
  })
  afterEach(async () => database.close())
  it("lists empty catalogs", async () => expect(await list()).toEqual([]))
  it("orders by normalized name", async () => {
    await seed("z", "Zulu")
    await seed("a", "Alpha")
    expect((await list()).map((x) => x.id)).toEqual(["a", "z"])
  })
  it("filters active selectors", async () => {
    await seed("a", "A")
    await seed("x", "X", "ARCHIVED")
    expect((await list("ACTIVE")).map((x) => x.id)).toEqual(["a"])
  })
  it("filters archived maintenance records", async () => {
    await seed("a", "A")
    await seed("x", "X", "ARCHIVED")
    expect((await list("ARCHIVED")).map((x) => x.id)).toEqual(["x"])
  })
  it("returns optional issuer", async () => {
    await seed("a", "A", "ACTIVE", "Issuer")
    await expect(list()).resolves.toMatchObject([{ issuerName: "Issuer" }])
  })
  it("returns normalized identifier values and market", async () => {
    await seed("a", "A")
    await database.execute(
      "INSERT INTO investment_instrument_identifiers (instrument_id,book_id,scheme,value,normalized_value,market) VALUES ('a','book-1','TICKER','PETR4','PETR4','B3')"
    )
    await expect(list()).resolves.toMatchObject([
      { identifiers: [{ scheme: "TICKER", value: "PETR4", market: "B3" }] },
    ])
  })
  it("returns null for a missing or other-book detail", async () => {
    await seed("a", "A")
    await expect(
      queries.getInvestmentInstrumentDetail({
        bookId: "book-2",
        instrumentId: "a",
      })
    ).resolves.toBeNull()
    await expect(
      queries.getInvestmentInstrumentDetail({
        bookId: "book-1",
        instrumentId: "missing",
      })
    ).resolves.toBeNull()
  })
  it("keeps book isolation", async () => {
    await seed("a", "A")
    await database.execute(
      "INSERT INTO financial_books (id,name,base_currency,timezone,version) VALUES ('book-2','Other','USD','UTC',0)"
    )
    await database.execute(
      "INSERT INTO investment_instruments (id,book_id,name,normalized_name,type,currency,status,version) VALUES ('other','book-2','Other','other','CDB','USD','ACTIVE',0)"
    )
    expect((await list()).map((x) => x.id)).toEqual(["a"])
  })
  function list(status?: "ACTIVE" | "ARCHIVED") {
    return queries.listInvestmentInstruments({
      bookId: "book-1",
      ...(status === undefined ? {} : { status }),
    })
  }
  async function seed(
    id: string,
    name: string,
    status: "ACTIVE" | "ARCHIVED" = "ACTIVE",
    issuer?: string
  ) {
    await database.execute(
      "INSERT INTO investment_instruments (id,book_id,name,normalized_name,type,currency,issuer_name,status,version) VALUES (?,?,?,?,?,?,?, ?,0)",
      [
        id,
        "book-1",
        name,
        name.toLowerCase(),
        "CDB",
        "BRL",
        issuer ?? null,
        status,
      ]
    )
  }
})
