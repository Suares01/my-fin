import Database from "better-sqlite3"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

describe("BetterSqliteDatabase", () => {
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  it("binds positional parameters and reports affected rows and row id", async () => {
    database = new BetterSqliteDatabase()
    await database.execute(
      "CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT, amount INTEGER)"
    )

    const result = await database.execute(
      "INSERT INTO records (name, amount) VALUES (?, ?)",
      ["first", 7]
    )

    expect(result.rowsAffected).toBe(1)
    expect(result.lastInsertRowId).toBe("1")
  })

  it("binds named parameters without interpolating values", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT, amount INTEGER)")

    await database.execute(
      "INSERT INTO records (name, amount) VALUES (@name, @amount)",
      { name: "value'); DROP TABLE records; --", amount: 9 }
    )

    const rows = await database.query<{ name: string; amount: number }>(
      "SELECT name, amount FROM records"
    )
    expect(rows).toEqual([
      { name: "value'); DROP TABLE records; --", amount: 9 },
    ])
  })

  it("queries rows and executes trusted batches", async () => {
    database = new BetterSqliteDatabase()
    await database.executeBatch(
      "CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT);" +
        "INSERT INTO records (name) VALUES ('first'), ('second');"
    )

    const rows = await database.query<{ id: number; name: string }>(
      "SELECT id, name FROM records ORDER BY id"
    )
    expect(rows).toEqual([
      { id: 1, name: "first" },
      { id: 2, name: "second" },
    ])
  })

  it("keeps public operations in FIFO order", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")

    const first = database.execute("INSERT INTO records (name) VALUES (?)", [
      "first",
    ])
    const second = database.execute("INSERT INTO records (name) VALUES (?)", [
      "second",
    ])
    const rowsPromise = database.query<{ name: string }>(
      "SELECT name FROM records"
    )

    await Promise.all([first, second])
    expect(await rowsPromise).toEqual([{ name: "first" }, { name: "second" }])
  })

  it("serializes concurrent transactions in submission order", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")

    const first = database.transaction(async (transactionExecutor) => {
      await transactionExecutor.execute(
        "INSERT INTO records (name) VALUES (?)",
        ["first"]
      )
      await delay(10)
    })
    const second = database.transaction(async (transactionExecutor) => {
      await transactionExecutor.execute(
        "INSERT INTO records (name) VALUES (?)",
        ["second"]
      )
    })

    await Promise.all([first, second])
    expect(
      await database.query<{ name: string }>(
        "SELECT name FROM records ORDER BY rowid"
      )
    ).toEqual([{ name: "first" }, { name: "second" }])
  })

  it("uses one private connection for an in-memory database", async () => {
    database = new BetterSqliteDatabase(":memory:")

    await database.execute("CREATE TABLE records (name TEXT)")
    await database.transaction(async (transactionExecutor) => {
      await transactionExecutor.execute(
        "INSERT INTO records (name) VALUES (?)",
        ["inside"]
      )
    })

    expect(await database.query("SELECT name FROM records")).toEqual([
      { name: "inside" },
    ])
  })

  it("waits for an active transaction before running an external query", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")
    let externalResolved = false
    let externalQuery: Promise<unknown[]> | undefined

    const transaction = database.transaction(async (transactionExecutor) => {
      await transactionExecutor.execute(
        "INSERT INTO records (name) VALUES (?)",
        ["inside"]
      )
      externalQuery = database
        .query("SELECT name FROM records")
        .then((rows) => {
          externalResolved = true
          return rows
        })
      await delay(10)
      expect(externalResolved).toBe(false)
    })

    await transaction
    expect(await externalQuery).toEqual([{ name: "inside" }])
  })

  it("uses the scoped executor for direct transactional statements", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")

    await database.transaction(async (transactionExecutor) => {
      await transactionExecutor.executeBatch(
        "INSERT INTO records (name) VALUES ('first');"
      )
      await transactionExecutor.execute(
        "INSERT INTO records (name) VALUES (?)",
        ["second"]
      )
      expect(
        await transactionExecutor.query<{ name: string }>(
          "SELECT name FROM records ORDER BY rowid"
        )
      ).toEqual([{ name: "first" }, { name: "second" }])
    })

    expect(
      await database.query<{ name: string }>("SELECT name FROM records")
    ).toHaveLength(2)
  })

  it("runs read callbacks with a deferred BEGIN and commits the snapshot", async () => {
    const connection = new Database(":memory:")
    database = new BetterSqliteDatabase(connection)
    const originalExec = connection.exec.bind(connection)
    const execSpy = vi
      .spyOn(connection, "exec")
      .mockImplementation((sql) => originalExec(sql))

    const result = await database.readTransaction(async (reader) => {
      expect("execute" in reader).toBe(false)
      expect("executeBatch" in reader).toBe(false)
      return await reader.query<{ value: number }>("SELECT 7 AS value")
    })

    expect(result).toEqual([{ value: 7 }])
    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("BEGIN")
    expect(execSpy.mock.calls.map(([sql]) => sql)).not.toContain(
      "BEGIN IMMEDIATE"
    )
    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("COMMIT")
  })

  it("keeps queued external work out of a read callback snapshot", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")
    let externalResolved = false
    let external: Promise<unknown> | undefined

    const read = database.readTransaction(async (reader) => {
      const before = await reader.query<{ name: string }>(
        "SELECT name FROM records"
      )
      external = database
        .execute("INSERT INTO records (name) VALUES (?)", ["outside"])
        .then(() => {
          externalResolved = true
        })
      await delay(10)
      expect(externalResolved).toBe(false)
      const during = await reader.query<{ name: string }>(
        "SELECT name FROM records"
      )
      return { before, during }
    })

    await expect(read).resolves.toEqual({ before: [], during: [] })
    await external
    expect(externalResolved).toBe(true)
    await expect(database.query("SELECT name FROM records")).resolves.toEqual([
      { name: "outside" },
    ])
  })

  it("serializes concurrent read callbacks in FIFO order", async () => {
    database = new BetterSqliteDatabase()
    const order: string[] = []

    const first = database.readTransaction(async () => {
      order.push("first:start")
      await delay(10)
      order.push("first:end")
    })
    const second = database.readTransaction(async () => {
      order.push("second:start")
      order.push("second:end")
    })

    await Promise.all([first, second])
    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ])
  })

  it("invalidates the scoped executor after commit", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")
    let scopedExecutor

    await database.transaction(async (transactionExecutor) => {
      scopedExecutor = transactionExecutor
    })

    await expect(scopedExecutor.execute("SELECT 1")).rejects.toThrow(
      "no longer active"
    )
  })

  it("invalidates the scoped executor after rollback", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")
    let scopedExecutor
    const failure = new Error("rollback")

    await expect(
      database.transaction(async (transactionExecutor) => {
        scopedExecutor = transactionExecutor
        throw failure
      })
    ).rejects.toBe(failure)

    await expect(scopedExecutor.execute("SELECT 1")).rejects.toThrow(
      "no longer active"
    )
  })

  it("invalidates the scoped reader after commit", async () => {
    database = new BetterSqliteDatabase()
    let reader

    await database.readTransaction(async (scopedReader) => {
      reader = scopedReader
    })

    await expect(reader.query("SELECT 1")).rejects.toThrow("no longer active")
  })

  it("rolls back read callback failures and preserves the original error", async () => {
    const connection = new Database(":memory:")
    database = new BetterSqliteDatabase(connection)
    const originalExec = connection.exec.bind(connection)
    const execSpy = vi
      .spyOn(connection, "exec")
      .mockImplementation((sql) => originalExec(sql))
    const failure = new Error("read callback failure")

    await expect(
      database.readTransaction(async () => {
        throw failure
      })
    ).rejects.toBe(failure)

    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK")
  })

  it("rolls back read commit failures and preserves the commit error", async () => {
    const connection = new Database(":memory:")
    database = new BetterSqliteDatabase(connection)
    const originalExec = connection.exec.bind(connection)
    const failure = new Error("read commit failure")
    const execSpy = vi.spyOn(connection, "exec").mockImplementation((sql) => {
      if (sql === "COMMIT") {
        throw failure
      }
      return originalExec(sql)
    })

    await expect(
      database.readTransaction(async (reader) => {
        await reader.query("SELECT 1")
      })
    ).rejects.toBe(failure)

    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK")
  })

  it("rolls back callback failures and preserves the original error", async () => {
    database = new BetterSqliteDatabase()
    await database.execute("CREATE TABLE records (name TEXT)")
    const failure = new Error("callback failure")

    await expect(
      database.transaction(async (transactionExecutor) => {
        await transactionExecutor.execute(
          "INSERT INTO records (name) VALUES (?)",
          ["partial"]
        )
        throw failure
      })
    ).rejects.toBe(failure)

    expect(await database.query("SELECT name FROM records")).toEqual([])
  })

  it("rolls back commit failures and preserves the commit error", async () => {
    const connection = new Database(":memory:")
    database = new BetterSqliteDatabase(connection)
    const originalExec = connection.exec.bind(connection)
    const failure = new Error("commit failure")
    const execSpy = vi.spyOn(connection, "exec").mockImplementation((sql) => {
      if (sql === "COMMIT") {
        throw failure
      }
      return originalExec(sql)
    })

    await database.execute("CREATE TABLE records (name TEXT)")
    await expect(
      database.transaction(async (transactionExecutor) => {
        await transactionExecutor.execute(
          "INSERT INTO records (name) VALUES (?)",
          ["partial"]
        )
      })
    ).rejects.toBe(failure)

    expect(await database.query("SELECT name FROM records")).toEqual([])
    expect(execSpy.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(true)
  })

  it("starts each transaction with BEGIN IMMEDIATE", async () => {
    const connection = new Database(":memory:")
    database = new BetterSqliteDatabase(connection)
    const originalExec = connection.exec.bind(connection)
    const execSpy = vi
      .spyOn(connection, "exec")
      .mockImplementation((sql) => originalExec(sql))

    await database.transaction(async () => undefined)

    expect(execSpy.mock.calls.map(([sql]) => sql)).toContain("BEGIN IMMEDIATE")
  })

  it("rejects new operations after close and closes the connection once", async () => {
    const connection = new Database(":memory:")
    database = new BetterSqliteDatabase(connection)
    const closeSpy = vi.spyOn(connection, "close")

    const firstClose = database.close()
    const secondClose = database.close()
    await firstClose
    await secondClose

    expect(closeSpy).toHaveBeenCalledTimes(1)
    await expect(database.query("SELECT 1")).rejects.toThrow("closed")
    await expect(
      database.readTransaction(async () => undefined)
    ).rejects.toThrow("closed")
  })
})
