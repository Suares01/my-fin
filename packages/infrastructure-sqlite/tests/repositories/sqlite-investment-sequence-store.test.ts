import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteInvestmentSequenceStore } from "../../src/repositories/sqlite-investment-sequence-store.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

describe("SqliteInvestmentSequenceStore", () => {
  let database: BetterSqliteDatabase
  let store: SqliteInvestmentSequenceStore
  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute("PRAGMA foreign_keys = OFF")
    store = new SqliteInvestmentSequenceStore(database)
  })
  afterEach(async () => database.close())
  it("starts at one as an exact string", async () => {
    await expect(store.next("book-1")).resolves.toBe("1")
  })
  it("increments monotonically in one book", async () => {
    await expect(store.next("book-1")).resolves.toBe("1")
    await expect(store.next("book-1")).resolves.toBe("2")
  })
  it("keeps books independent", async () => {
    await store.next("book-1")
    await expect(store.next("book-2")).resolves.toBe("1")
  })
  it("preserves a sequence above JavaScript safe integer as a string", async () => {
    await database.execute(
      "INSERT INTO investment_sequences (book_id, last_sequence) VALUES ('book-1', 9007199254740992)"
    )
    await expect(store.next("book-1")).resolves.toBe("9007199254740993")
  })
  it("rolls back a reserved sequence with its transaction", async () => {
    await expect(
      database.transaction(async (executor) => {
        await new SqliteInvestmentSequenceStore(executor).next("book-1")
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")
    await expect(store.next("book-1")).resolves.toBe("1")
  })
  it("rejects overflow before changing the persisted counter", async () => {
    await database.execute(
      "INSERT INTO investment_sequences (book_id, last_sequence) VALUES ('book-1', 9223372036854775807)"
    )
    await expect(store.next("book-1")).rejects.toMatchObject({
      code: "UNEXPECTED_ERROR",
    })
    await expect(
      database.query(
        "SELECT CAST(last_sequence AS TEXT) AS last_sequence FROM investment_sequences WHERE book_id = 'book-1'"
      )
    ).resolves.toEqual([{ last_sequence: "9223372036854775807" }])
  })
})
