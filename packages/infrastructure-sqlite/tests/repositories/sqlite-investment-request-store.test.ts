import type { InvestmentRequestReceipt } from "@workspace/application"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentRequestStore } from "../../src/repositories/sqlite-investment-request-store.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function receipt(
  overrides: Partial<InvestmentRequestReceipt> = {}
): InvestmentRequestReceipt {
  return {
    bookId: "book-1",
    requestId: "request-1",
    formatVersion: 1,
    canonicalCommand: "{}",
    result: {
      requestId: "request-1",
      positionId: "position-1",
      positionVersion: 2,
      allocationRevision: 3,
      operationId: "operation-1",
      journalEntryIds: ["journal-1"],
      warnings: [
        {
          code: "INVESTMENT_CASH_NEGATIVE",
          investmentAccountId: "account-1",
          cashMinor: "-100",
          currency: "BRL",
          asOf: "2026-01-01",
        },
      ],
    },
    recordedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  }
}
describe("SqliteInvestmentRequestStore", () => {
  let database: BetterSqliteDatabase
  let store: SqliteInvestmentRequestStore
  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute("PRAGMA foreign_keys = OFF")
    store = new SqliteInvestmentRequestStore(database)
  })
  afterEach(async () => database.close())
  it("returns null for a missing book/request receipt", async () => {
    await expect(store.find("book-1", "missing")).resolves.toBeNull()
  })
  it("round-trips the immutable command and result exactly", async () => {
    const value = receipt()
    await store.add(value)
    await expect(store.find(value.bookId, value.requestId)).resolves.toEqual(
      value
    )
  })
  it("scopes receipts by book and request", async () => {
    await store.add(receipt())
    await expect(store.find("book-2", "request-1")).resolves.toBeNull()
    await expect(store.find("book-1", "request-2")).resolves.toBeNull()
  })
  it("preserves empty optional result identifiers", async () => {
    const value = receipt({
      result: { requestId: "request-1", journalEntryIds: [], warnings: [] },
    })
    await store.add(value)
    await expect(store.find("book-1", "request-1")).resolves.toEqual(value)
  })
  it("rejects duplicate book/request without overwriting the first receipt", async () => {
    const first = receipt()
    await store.add(first)
    await expect(
      store.add(receipt({ canonicalCommand: '{"different":true}' }))
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
    await expect(store.find("book-1", "request-1")).resolves.toEqual(first)
  })
  it("stores independent requests for the same book", async () => {
    await store.add(receipt())
    await store.add(
      receipt({
        requestId: "request-2",
        result: { requestId: "request-2", journalEntryIds: [], warnings: [] },
      })
    )
    await expect(
      database.query(
        "SELECT request_id FROM investment_request_receipts ORDER BY request_id"
      )
    ).resolves.toEqual([
      { request_id: "request-1" },
      { request_id: "request-2" },
    ])
  })
  it("rolls back the receipt with its transaction", async () => {
    await expect(
      database.transaction(async (executor) => {
        await new SqliteInvestmentRequestStore(executor).add(receipt())
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")
    await expect(store.find("book-1", "request-1")).resolves.toBeNull()
  })
  it("does not create a receipt when insertion fails", async () => {
    await expect(store.add(receipt({ requestId: "" }))).rejects.toBeDefined()
    await expect(store.find("book-1", "")).resolves.toBeNull()
  })
})
