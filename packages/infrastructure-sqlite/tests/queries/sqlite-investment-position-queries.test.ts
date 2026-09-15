import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentPositionQueries } from "../../src/queries/investments/sqlite-investment-position-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"
describe("SqliteInvestmentPositionQueries", () => {
  let db: BetterSqliteDatabase
  let q: SqliteInvestmentPositionQueries
  beforeEach(async () => {
    db = new BetterSqliteDatabase()
    await initializeSqliteDatabase(db, { inMemory: true })
    await db.execute(
      "INSERT INTO financial_books VALUES ('b','B','BRL','UTC',0)"
    )
    q = new SqliteInvestmentPositionQueries(db)
    await seed("p1", "Alpha", "OPEN", "10")
    await seed("p2", "Beta", "CLOSED", "20")
  })
  afterEach(async () => db.close())
  it("defaults OPEN", async () => expect((await list()).items).toHaveLength(1))
  it("filters CLOSED", async () =>
    expect((await list({ status: "CLOSED" })).items[0]?.id).toBe("p2"))
  it("orders normalized name", async () =>
    expect((await list({ status: "CLOSED" })).items[0]?.instrumentName).toBe(
      "Beta"
    ))
  it("returns cost fallback", async () =>
    expect((await list()).items[0]?.valuation).toMatchObject({
      basis: "BOOK_COST",
      currentValueMinor: "10",
    }))
  it("returns closed zero", async () =>
    expect(
      (await list({ status: "CLOSED" })).items[0]?.valuation
    ).toMatchObject({ basis: "CLOSED", currentValueMinor: "0" }))
  it("filters literal search", async () =>
    expect((await list({ search: "alpha" })).items).toHaveLength(1))
  it("does not wildcard search", async () =>
    expect((await list({ search: "%" })).items).toHaveLength(0))
  it("filters account", async () =>
    expect((await list({ accountId: "missing" })).items).toHaveLength(0))
  it("filters class", async () =>
    expect((await list({ assetClass: "STOCK" })).items).toHaveLength(0))
  it("keeps book isolation", async () =>
    expect(
      (await q.listPositions({ bookId: "other", limit: 25, status: "OPEN" }))
        .items
    ).toEqual([]))
  it("uses 25-compatible limits", async () =>
    expect((await list({ limit: 25 })).nextCursor).toBeNull())
  it("rejects cursor fingerprint", async () =>
    await expect(
      q.listPositions({
        bookId: "b",
        limit: 1,
        status: "OPEN",
        cursor:
          "ip1.%7B%22fingerprint%22%3A%22x%22%2C%22name%22%3A%22a%22%2C%22label%22%3A%22%22%2C%22id%22%3A%22x%22%7D",
      })
    ).rejects.toThrow())
  it("includes quantity", async () =>
    expect((await list()).items[0]?.quantity).toBe("1"))
  it("includes currency", async () =>
    expect((await list()).items[0]?.currency).toBe("BRL"))
  it("includes labels when present", async () =>
    expect((await list()).items[0]?.label).toBe("label"))
  it("returns empty page", async () =>
    expect((await list({ accountId: "none" })).items).toEqual([]))
  function list(
    x: Partial<{
      status: "OPEN" | "CLOSED"
      search: string
      accountId: string
      assetClass: string
      limit: number
    }> = {}
  ) {
    return q.listPositions({ bookId: "b", status: "OPEN", limit: 25, ...x })
  }
  async function seed(
    id: string,
    name: string,
    status: "OPEN" | "CLOSED",
    cost: string
  ) {
    await db.execute(
      "INSERT OR IGNORE INTO ledger_accounts (id,book_id,name,normalized_name,kind,status,system_purpose,version) VALUES ('a','b','A','a','ASSET','ACTIVE',NULL,0)"
    )
    await db.execute(
      "INSERT OR IGNORE INTO financial_accounts (ledger_account_id,book_id,type) VALUES ('a','b','INVESTMENT_ACCOUNT')"
    )
    await db.execute(
      "INSERT OR IGNORE INTO investment_accounts (ledger_account_id,book_id) VALUES ('a','b')"
    )
    await db.execute(
      "INSERT INTO investment_instruments VALUES (?, 'b', ?, ?, 'CDB','BRL',NULL,'ACTIVE',0)",
      [`i-${id}`, name, name.toLowerCase()]
    )
    await db.execute(
      "INSERT INTO investment_positions VALUES (?, 'b','a',?,'label','label','UNITS','1',?,'BRL','2026-01-01',?, ?,1,'2026-01-01',0)",
      [id, `i-${id}`, cost, status === "CLOSED" ? "2026-01-02" : null, status]
    )
  }
})
