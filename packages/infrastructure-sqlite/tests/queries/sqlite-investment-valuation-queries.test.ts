import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentValuationQueries } from "../../src/queries/investments/sqlite-investment-valuation-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"
describe("SqliteInvestmentValuationQueries", () => {
  let db: BetterSqliteDatabase
  let q: SqliteInvestmentValuationQueries
  beforeEach(async () => {
    db = new BetterSqliteDatabase()
    await initializeSqliteDatabase(db, { inMemory: true })
    await db.execute(
      "INSERT INTO financial_books (id,name,base_currency,timezone,version) VALUES ('b','B','BRL','UTC',0)"
    )
    await db.execute(
      "INSERT INTO ledger_accounts (id,book_id,name,normalized_name,kind,status,system_purpose,version) VALUES ('a','b','A','a','ASSET','ACTIVE',NULL,0)"
    )
    await db.execute(
      "INSERT INTO financial_accounts (ledger_account_id,book_id,type) VALUES ('a','b','INVESTMENT_ACCOUNT')"
    )
    await db.execute(
      "INSERT INTO investment_accounts (ledger_account_id,book_id) VALUES ('a','b')"
    )
    await db.execute(
      "INSERT INTO investment_instruments (id,book_id,name,normalized_name,type,currency,status,version) VALUES ('i','b','I','i','CDB','BRL','ACTIVE',0)"
    )
    await db.execute(
      "INSERT INTO investment_positions (id,book_id,investment_account_id,instrument_id,normalized_label,quantity_mode,book_cost_minor,currency,opened_on,status,allocation_revision,allocation_effective_on,version) VALUES ('p','b','a','i','','AMOUNT',0,'BRL','2026-01-01','OPEN',2,'2026-01-01',0)"
    )
    q = new SqliteInvestmentValuationQueries(db)
    await seed("v1", "2026-01-01T00:00:00.000Z", 1, 1, "10")
    await seed("v2", "2026-01-02T00:00:00.000Z", 2, 2, "20")
  })
  afterEach(async () => db.close())
  it("orders newest first", async () =>
    expect((await list()).items.map((x) => x.id)).toEqual(["v2", "v1"]))
  it("orders equal-time sequences numerically and paginates without skipping", async () => {
    await seed("v12", "2026-01-02T00:00:00.000Z", 12, 2, "120")
    expect((await list()).items.map((item) => item.id)).toEqual([
      "v12",
      "v2",
      "v1",
    ])
    const first = await q.listValuations({
      bookId: "b",
      positionId: "p",
      limit: 1,
    })
    expect(first.items.map((item) => item.id)).toEqual(["v12"])
    const second = await q.listValuations({
      bookId: "b",
      positionId: "p",
      limit: 1,
      cursor: first.nextCursor!,
    })
    expect(second.items.map((item) => item.id)).toEqual(["v2"])
  })
  it("preserves historical revision", async () =>
    expect((await list()).items[1]).toMatchObject({ allocationRevision: 1 }))
  it("preserves gross value", async () =>
    expect((await list()).items[0]?.grossValueMinor).toBe("20"))
  it("returns observation time and currency without inventing optional values", async () => {
    const item = (await list()).items[0]
    expect(item).toMatchObject({
      recordedAt: "2026-01-02T00:00:00.000Z",
      currency: "BRL",
      allocationRevision: 2,
    })
    expect(item).not.toHaveProperty("quantity")
    expect(item).not.toHaveProperty("unitPrice")
    expect(item).not.toHaveProperty("netValueMinor")
    expect(item).not.toHaveProperty("withdrawableValueMinor")
  })
  it("returns quantity, unit price, net and withdrawable values when persisted", async () => {
    await db.execute(
      "INSERT INTO investment_valuations (id,book_id,position_id,allocation_revision,valued_at,valued_on,recorded_at,record_sequence,source,quantity,unit_price,currency,gross_value_minor,net_value_minor,withdrawable_value_minor) VALUES ('v3','b','p',2,'2026-01-03T00:00:00.000Z','2026-01-03','2026-01-04T10:00:00.000Z',3,'MANUAL','10','5.20','BRL',520,518,300)"
    )
    expect((await list()).items[0]).toMatchObject({
      id: "v3",
      valuedAt: "2026-01-03T00:00:00.000Z",
      recordedAt: "2026-01-04T10:00:00.000Z",
      quantity: "10",
      unitPrice: "5.20",
      grossValueMinor: "520",
      netValueMinor: "518",
      withdrawableValueMinor: "300",
    })
  })
  it("scopes position", async () =>
    expect(
      (await q.listValuations({ bookId: "b", positionId: "x", limit: 25 }))
        .items
    ).toEqual([]))
  it("scopes book", async () =>
    expect(
      (await q.listValuations({ bookId: "x", positionId: "p", limit: 25 }))
        .items
    ).toEqual([]))
  it("paginates", async () =>
    expect(
      (await q.listValuations({ bookId: "b", positionId: "p", limit: 1 }))
        .nextCursor
    ).toMatch(/^iv1/))
  it("has final null cursor", async () =>
    expect((await list()).nextCursor).toBeNull())
  it("rejects foreign fingerprint", async () =>
    await expect(
      q.listValuations({
        bookId: "b",
        positionId: "p",
        limit: 1,
        cursor:
          "iv1.%7B%22fingerprint%22%3A%22x%22%2C%22valuedAt%22%3A%22x%22%2C%22sequence%22%3A%221%22%2C%22id%22%3A%22x%22%7D",
      })
    ).rejects.toThrow())
  it("keeps deterministic record sequence", async () =>
    expect((await list()).items[0]?.recordSequence).toBe("2"))
  it("does not invent unknown rows", async () =>
    expect(
      (await q.listValuations({ bookId: "b", positionId: "none", limit: 25 }))
        .items
    ).toEqual([]))
  function list() {
    return q.listValuations({ bookId: "b", positionId: "p", limit: 25 })
  }
  async function seed(
    id: string,
    at: string,
    seq: number,
    revision: number,
    gross: string
  ) {
    await db.execute(
      "INSERT INTO investment_valuations (id,book_id,position_id,allocation_revision,valued_at,valued_on,recorded_at,record_sequence,source,currency,gross_value_minor) VALUES (?,'b','p',?,?,?, ?,?,'MANUAL','BRL',?)",
      [id, revision, at, at.slice(0, 10), at, seq, gross]
    )
  }
})
