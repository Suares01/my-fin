import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentOperationQueries } from "../../src/queries/investments/sqlite-investment-operation-queries.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"
describe("SqliteInvestmentOperationQueries", () => {
  let db: BetterSqliteDatabase
  let q: SqliteInvestmentOperationQueries
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
      "INSERT INTO investment_positions (id,book_id,investment_account_id,instrument_id,normalized_label,quantity_mode,book_cost_minor,currency,opened_on,status,allocation_revision,allocation_effective_on,version) VALUES ('p','b','a','i','','AMOUNT',0,'BRL','2026-01-01','OPEN',1,'2026-01-01',0)"
    )
    await db.execute(
      "INSERT INTO journal_entries (id,book_id,occurred_on,recorded_at,sequence,description,currency,origin,version) VALUES ('j','b','2026-01-01','2026-01-01T00:00:00.000Z',1,'j','BRL','MANUAL',0)"
    )
    q = new SqliteInvestmentOperationQueries(db)
    await seed("o1", "2026-01-01", 1)
    await seed("o2", "2026-01-02", 2, "j", "o1")
  })
  afterEach(async () => db.close())
  it("orders date descending", async () =>
    expect((await list()).items.map((x) => x.id)).toEqual(["o2", "o1"]))
  it("returns optional journal", async () =>
    expect((await list()).items[0]).toMatchObject({ journalEntryId: "j" }))
  it("keeps no-journal operation", async () =>
    expect((await list()).items[1]).not.toHaveProperty("journalEntryId"))
  it("returns reversal lineage", async () =>
    expect((await list()).items[0]).toMatchObject({ reversalOf: "o1" }))
  it("returns effects", async () =>
    expect((await list()).items[0]).toMatchObject({
      grossAmountMinor: "10",
      netCashFlowMinor: "-10",
      bookCostDeltaMinor: "10",
    }))
  it("scopes position", async () =>
    expect(
      (await q.listOperations({ bookId: "b", positionId: "other", limit: 25 }))
        .items
    ).toEqual([]))
  it("scopes book", async () =>
    expect(
      (await q.listOperations({ bookId: "other", positionId: "p", limit: 25 }))
        .items
    ).toEqual([]))
  it("paginates", async () => {
    const a = await q.listOperations({ bookId: "b", positionId: "p", limit: 1 })
    expect(a.nextCursor).toMatch(/^io1/)
  })
  it("rejects foreign cursor", async () =>
    await expect(
      q.listOperations({
        bookId: "b",
        positionId: "p",
        limit: 1,
        cursor:
          "io1.%7B%22fingerprint%22%3A%22x%22%2C%22occurredOn%22%3A%22x%22%2C%22sequence%22%3A%221%22%2C%22id%22%3A%22x%22%7D",
      })
    ).rejects.toThrow())
  it("preserves type", async () =>
    expect((await list()).items[0]?.type).toBe("PURCHASE"))
  it("preserves sequence", async () =>
    expect((await list()).items[0]?.sequence).toBe("2"))
  it("ends cursor at final page", async () =>
    expect((await list()).nextCursor).toBeNull())
  it("returns persisted fields needed to amend the same operation", async () => {
    expect((await list()).items[0]).toMatchObject({
      id: "o2",
      type: "PURCHASE",
      role: "BUSINESS",
      version: 0,
      description: "Original",
      currency: "BRL",
      quantityDelta: "2",
      feesMinor: "0",
      taxesMinor: "0",
      cashMode: "EXTERNAL_ACCOUNT",
      settlementAccountId: "a",
      gainCategoryId: "a",
      lossCategoryId: "a",
      incomeCategoryId: "a",
      feeCategoryId: "a",
      taxCategoryId: "a",
      beforeKind: "EXISTING",
      beforeQuantity: "5",
      beforeBookCostMinor: "100",
      beforeStatus: "OPEN",
      beforeOpenedOn: "2026-01-01",
      beforeAllocationEffectiveOn: "2026-01-01",
    })
  })
  it.each([
    "APPLICATION",
    "SALE",
    "REDEMPTION",
    "INCOME",
    "AMORTIZATION",
    "FEE",
    "TAX",
    "OPENING_ALLOCATION",
  ])("preserves %s for correction routing", async (type) => {
    await db.execute("UPDATE investment_operations SET type=? WHERE id='o2'", [
      type,
    ])
    expect((await list()).items[0]?.type).toBe(type)
  })
  it("exposes lineage and version for the last effective operation", async () => {
    await db.execute(
      "UPDATE investment_operations SET reversed_by_id='o1', version=1 WHERE id='o2'"
    )
    expect((await list()).items[0]).toMatchObject({
      role: "BUSINESS",
      version: 1,
      reversalOf: "o1",
      reversedBy: "o1",
    })
  })
  function list() {
    return q.listOperations({ bookId: "b", positionId: "p", limit: 25 })
  }
  async function seed(
    id: string,
    date: string,
    sequence: number,
    journal?: string,
    reversal?: string
  ) {
    await db.execute(
      "INSERT INTO investment_operations (id,book_id,position_id,type,role,occurred_on,recorded_at,sequence,description,currency,quantity_delta,book_cost_delta_minor,gross_amount_minor,fees_minor,taxes_minor,net_cash_flow_minor,cash_mode,settlement_account_id,gain_category_id,loss_category_id,income_category_id,fee_category_id,tax_category_id,before_kind,before_quantity,before_book_cost_minor,before_status,before_opened_on,before_allocation_effective_on,version,journal_entry_id,reversal_of_id) VALUES (?, 'b','p','PURCHASE','BUSINESS',?,'2026-01-01T00:00:00.000Z',?,'Original','BRL','2',10,10,0,0,-10,'EXTERNAL_ACCOUNT','a','a','a','a','a','a','EXISTING','5',100,'OPEN','2026-01-01','2026-01-01',0,?,?)",
      [id, date, sequence, journal ?? null, reversal ?? null]
    )
  }
})
