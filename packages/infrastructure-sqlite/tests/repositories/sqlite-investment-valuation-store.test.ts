import type { InvestmentValuationSnapshot } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentValuationStore } from "../../src/repositories/sqlite-investment-valuation-store.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function valuation(
  overrides: Partial<InvestmentValuationSnapshot> = {}
): InvestmentValuationSnapshot {
  return {
    id: "valuation-1" as never,
    bookId: "book-1" as never,
    positionId: "position-1" as never,
    allocationRevision: 1,
    valuedAt: "2026-01-01T10:00:00.000Z",
    valuedOn: "2026-01-01",
    recordedAt: "2026-01-01T11:00:00.000Z",
    recordSequence: "1",
    source: "MANUAL",
    quantity: "10",
    unitPrice: "12.5",
    currency: "BRL",
    grossValueMinor: "1250000000000000",
    netValueMinor: "1240000000000000",
    withdrawableValueMinor: "1000000000000000",
    ...overrides,
  }
}

describe("SqliteInvestmentValuationStore", () => {
  let database: BetterSqliteDatabase
  let store: SqliteInvestmentValuationStore
  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute("PRAGMA foreign_keys = OFF")
    store = new SqliteInvestmentValuationStore(database)
  })
  afterEach(async () => database.close())

  it("appends every exact valuation field", async () => {
    const value = valuation()
    await store.append(value)
    await expect(
      database.query(
        "SELECT id, book_id, position_id, allocation_revision, valued_at, valued_on, recorded_at, CAST(record_sequence AS TEXT) AS record_sequence, source, quantity, unit_price, currency, CAST(gross_value_minor AS TEXT) AS gross_value_minor, CAST(net_value_minor AS TEXT) AS net_value_minor, CAST(withdrawable_value_minor AS TEXT) AS withdrawable_value_minor FROM investment_valuations"
      )
    ).resolves.toEqual([
      {
        id: value.id,
        book_id: value.bookId,
        position_id: value.positionId,
        allocation_revision: 1,
        valued_at: value.valuedAt,
        valued_on: value.valuedOn,
        recorded_at: value.recordedAt,
        record_sequence: value.recordSequence,
        source: "MANUAL",
        quantity: value.quantity,
        unit_price: value.unitPrice,
        currency: "BRL",
        gross_value_minor: value.grossValueMinor,
        net_value_minor: value.netValueMinor,
        withdrawable_value_minor: value.withdrawableValueMinor,
      },
    ])
  })
  it("preserves absent optional value fields as NULL", async () => {
    await store.append(
      valuation({
        quantity: undefined,
        unitPrice: undefined,
        netValueMinor: undefined,
        withdrawableValueMinor: undefined,
      })
    )
    await expect(
      database.query(
        "SELECT quantity, unit_price, net_value_minor, withdrawable_value_minor FROM investment_valuations"
      )
    ).resolves.toEqual([
      {
        quantity: null,
        unit_price: null,
        net_value_minor: null,
        withdrawable_value_minor: null,
      },
    ])
  })
  it("appends distinct observations at the same instant", async () => {
    await store.append(valuation())
    await store.append(
      valuation({ id: "valuation-2" as never, recordSequence: "2" })
    )
    await expect(
      database.query(
        "SELECT id FROM investment_valuations ORDER BY record_sequence"
      )
    ).resolves.toEqual([{ id: "valuation-1" }, { id: "valuation-2" }])
  })
  it("preserves allocation revision independently from record sequence", async () => {
    await store.append(
      valuation({ allocationRevision: 3, recordSequence: "7" })
    )
    await expect(
      database.query(
        "SELECT allocation_revision, CAST(record_sequence AS TEXT) AS record_sequence FROM investment_valuations"
      )
    ).resolves.toEqual([{ allocation_revision: 3, record_sequence: "7" }])
  })
  it("rejects duplicate valuation identity", async () => {
    await store.append(valuation())
    await expect(store.append(valuation())).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    })
  })
  it("rejects duplicate record sequence in a book", async () => {
    await store.append(valuation())
    await expect(
      store.append(valuation({ id: "valuation-2" as never }))
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
  })
  it("rolls back an appended observation with its transaction", async () => {
    await expect(
      database.transaction(async (executor) => {
        await new SqliteInvestmentValuationStore(executor).append(valuation())
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")
    await expect(
      database.query("SELECT id FROM investment_valuations")
    ).resolves.toEqual([])
  })
  it("has no public update or delete path and SQLite rejects both mutations", async () => {
    await store.append(valuation())
    await expect(
      database.execute("UPDATE investment_valuations SET gross_value_minor = 1")
    ).rejects.toThrow()
    await expect(
      database.execute("DELETE FROM investment_valuations")
    ).rejects.toThrow()
  })
})
