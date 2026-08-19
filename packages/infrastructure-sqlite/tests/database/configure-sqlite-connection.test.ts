import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

describe("configureSqliteConnection", () => {
  const temporaryDirectories: string[] = []
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true }))
    )
  })

  it("enables foreign keys for an in-memory connection", async () => {
    database = new BetterSqliteDatabase(":memory:")

    await configureSqliteConnection(database, { inMemory: true })

    const rows = await database.query<{ foreign_keys: number }>(
      "PRAGMA foreign_keys"
    )
    expect(rows).toEqual([{ foreign_keys: 1 }])
  })

  it("sets the busy timeout for an in-memory connection", async () => {
    database = new BetterSqliteDatabase(":memory:")

    await configureSqliteConnection(database, { inMemory: true })

    const rows = await database.query<{ timeout: number }>(
      "PRAGMA busy_timeout"
    )
    expect(rows).toEqual([{ timeout: 5000 }])
  })

  it("keeps the in-memory journal mode without requesting WAL", async () => {
    database = new BetterSqliteDatabase(":memory:")

    await configureSqliteConnection(database, { inMemory: true })

    const rows = await database.query<{ journal_mode: string }>(
      "PRAGMA journal_mode"
    )
    expect(rows).toEqual([{ journal_mode: "memory" }])
  })

  it("enables foreign keys and timeout for a file connection", async () => {
    const directory = await mkdtemp(join(tmpdir(), "open-coin-sqlite-"))
    temporaryDirectories.push(directory)
    database = new BetterSqliteDatabase(join(directory, "ledger.sqlite"))

    await configureSqliteConnection(database, { inMemory: false })

    expect(
      await database.query<{ foreign_keys: number }>("PRAGMA foreign_keys")
    ).toEqual([{ foreign_keys: 1 }])
    expect(
      await database.query<{ timeout: number }>("PRAGMA busy_timeout")
    ).toEqual([{ timeout: 5000 }])
  })

  it("uses WAL and FULL synchronous mode for a file connection", async () => {
    const directory = await mkdtemp(join(tmpdir(), "open-coin-sqlite-"))
    temporaryDirectories.push(directory)
    database = new BetterSqliteDatabase(join(directory, "ledger.sqlite"))

    await configureSqliteConnection(database, { inMemory: false })

    expect(
      await database.query<{ journal_mode: string }>("PRAGMA journal_mode")
    ).toEqual([{ journal_mode: "wal" }])
    expect(
      await database.query<{ synchronous: number }>("PRAGMA synchronous")
    ).toEqual([{ synchronous: 2 }])
  })

  it("rejects configuration after a transaction has started", async () => {
    database = new BetterSqliteDatabase(":memory:")

    await database.transaction(async (transactionExecutor) => {
      await expect(
        configureSqliteConnection(database, { inMemory: true })
      ).rejects.toThrow("before starting a transaction")
      await transactionExecutor.execute("SELECT 1")
    })
  })
})
