import { describe, expect, it } from "vitest"

import type { SqliteExecutor } from "@workspace/infrastructure-sqlite"

import {
  TauriSqliteDatabase,
  type TauriInvoke,
} from "./tauri-sqlite-database.js"
import { TauriDatabaseError } from "./protocol.js"
import * as publicApi from "../index.js"

type Call = { command: string; args?: Record<string, unknown> }

function fakeInvoke(
  handler?: (
    command: string,
    args: Record<string, unknown> | undefined
  ) => unknown
) {
  const calls: Call[] = []
  const invoke: TauriInvoke = async <T>(
    command: string,
    args: Record<string, unknown> | undefined
  ) => {
    calls.push({ command, args })
    if (handler) {
      return (await handler(command, args)) as T
    }
    switch (command) {
      case "database_begin_transaction":
        return "tx-1" as T
      case "database_execute":
        return { rowsAffected: 1, lastInsertRowId: "7" } as T
      case "database_query":
        return [{ id: { type: "integer", value: "1" } }] as T
      default:
        return undefined as T
    }
  }
  return { calls, invoke }
}

async function openedDatabase(handler?: Parameters<typeof fakeInvoke>[0]) {
  const fake = fakeInvoke(handler)
  const database = new TauriSqliteDatabase({ invoke: fake.invoke })
  await database.open()
  return { database, ...fake }
}

describe("TauriSqliteDatabase", () => {
  it("exports the adapter through the public package API", () => {
    expect(publicApi.TauriSqliteDatabase).toBe(TauriSqliteDatabase)
  })

  it("rejects operations before open", async () => {
    const database = new TauriSqliteDatabase({ invoke: fakeInvoke().invoke })
    await expect(database.query("SELECT 1")).rejects.toMatchObject({
      code: "DATABASE_NOT_OPEN",
    })
  })

  it("opens the approved vault with the exact command payload", async () => {
    const { database, calls } = await openedDatabase()
    expect(calls).toEqual([
      {
        command: "database_open",
        args: { request: { vaultName: "open-coin.sqlite" } },
      },
    ])
    await database.close()
  })

  it("encodes execute parameters and decodes the result", async () => {
    const { database, calls } = await openedDatabase()
    await expect(
      database.execute("INSERT INTO items VALUES (?1)", ["cash", 7])
    ).resolves.toEqual({
      rowsAffected: 1,
      lastInsertRowId: "7",
    })
    expect(calls[1]).toEqual({
      command: "database_execute",
      args: {
        request: {
          sql: "INSERT INTO items VALUES (?1)",
          parameters: {
            kind: "positional",
            values: [
              { type: "text", value: "cash" },
              { type: "integer", value: "7" },
            ],
          },
        },
      },
    })
    await database.close()
  })

  it("preserves named parameters and decoded row types", async () => {
    const { database, calls } = await openedDatabase()
    await expect(
      database.query("SELECT :bookId", { bookId: "book-1" })
    ).resolves.toEqual([{ id: "1" }])
    expect(calls[1]!.args).toEqual({
      request: {
        sql: "SELECT :bookId",
        parameters: {
          kind: "named",
          values: { bookId: { type: "text", value: "book-1" } },
        },
      },
    })
    await database.close()
  })

  it("sends batch and health commands through the public queue", async () => {
    const { database, calls } = await openedDatabase()
    await database.executeBatch("CREATE TABLE items (id INTEGER)")
    await database.health()
    expect(calls.slice(1).map(({ command }) => command)).toEqual([
      "database_execute_batch",
      "database_health",
    ])
    await database.close()
  })

  it("keeps the whole write callback contiguous and commits its scope", async () => {
    const { database, calls } = await openedDatabase()
    await database.transaction(async (executor) => {
      await executor.execute("INSERT INTO items VALUES (?1)", ["one"])
      await executor.query("SELECT 1")
      await executor.executeBatch("UPDATE items SET id = 1")
    })
    expect(calls.slice(1).map(({ command }) => command)).toEqual([
      "database_begin_transaction",
      "database_execute",
      "database_query",
      "database_execute_batch",
      "database_commit_transaction",
    ])
    await database.close()
  })

  it("begins read transactions with read mode and only exposes a reader", async () => {
    const { database, calls } = await openedDatabase()
    await database.readTransaction(async (reader) => {
      await reader.query("SELECT 1")
      expect((reader as SqliteExecutor).execute).toBeUndefined()
    })
    expect(calls[1]).toEqual({
      command: "database_begin_transaction",
      args: { request: { mode: "read" } },
    })
    expect(calls.at(-1)?.command).toBe("database_commit_transaction")
    await database.close()
  })

  it("passes transaction IDs only to scoped command payloads", async () => {
    const { database, calls } = await openedDatabase()
    await database.transaction(async (executor) => {
      await executor.execute("SELECT 1")
    })
    expect(calls[2]!.args).toEqual({
      request: {
        sql: "SELECT 1",
        parameters: { kind: "positional", values: [] },
        transactionId: "tx-1",
      },
    })
    await database.close()
  })

  it("rolls back callback failure while preserving the original cause", async () => {
    const { database, calls } = await openedDatabase()
    const cause = new Error("callback failed")
    await expect(
      database.transaction(async () => {
        throw cause
      })
    ).rejects.toBe(cause)
    expect(calls.at(-1)?.command).toBe("database_rollback_transaction")
    await database.close()
  })

  it("attempts rollback after commit failure without replacing the commit error", async () => {
    const commitError = { code: "DATABASE_FAILURE", diagnosticId: "diag-1" }
    const { database, calls } = await openedDatabase((command) => {
      if (command === "database_commit_transaction") {
        throw commitError
      }
      return undefined
    })
    await expect(
      database.transaction(async () => "done")
    ).rejects.toMatchObject({
      code: "DATABASE_FAILURE",
      diagnosticId: "diag-1",
    })
    expect(calls.at(-1)?.command).toBe("database_rollback_transaction")
    await database.close()
  })

  it("invalidates scoped readers after the callback", async () => {
    const { database } = await openedDatabase()
    let reader: { query: SqliteExecutor["query"] } | undefined
    await database.readTransaction(async (scope) => {
      reader = scope
    })
    await expect(reader?.query("SELECT 1")).rejects.toMatchObject({
      code: "TRANSACTION_SCOPE_CLOSED",
    })
    await database.close()
  })

  it("invalidates scoped executors after callback failure", async () => {
    const { database } = await openedDatabase()
    let executor: SqliteExecutor | undefined
    await expect(
      database.transaction(async (scope) => {
        executor = scope
        throw new Error("stop")
      })
    ).rejects.toThrow("stop")
    await expect(executor?.execute("SELECT 1")).rejects.toMatchObject({
      code: "TRANSACTION_SCOPE_CLOSED",
    })
    await database.close()
  })

  it("close is idempotent and invokes the command once", async () => {
    const { database, calls } = await openedDatabase()
    await Promise.all([database.close(), database.close(), database.close()])
    expect(
      calls.filter(({ command }) => command === "database_close")
    ).toHaveLength(1)
  })

  it("rejects new operations once close begins", async () => {
    const { database } = await openedDatabase()
    const closing = database.close()
    await expect(database.health()).rejects.toMatchObject({
      code: "DATABASE_NOT_OPEN",
    })
    await closing
  })

  it("does not interleave a queued operation into a transaction callback", async () => {
    const { database, calls } = await openedDatabase()
    const transaction = database.transaction(async (executor) => {
      await executor.query("SELECT transaction")
    })
    const queued = database.query("SELECT public")
    await transaction
    await queued
    const commands = calls.map(({ command }) => command)
    expect(commands.indexOf("database_commit_transaction")).toBeLessThan(
      commands.lastIndexOf("database_query")
    )
    await database.close()
  })

  it("converts malformed IPC results into a safe adapter error", async () => {
    const { database } = await openedDatabase((command) =>
      command === "database_execute" ? { rowsAffected: 1.5 } : undefined
    )
    await expect(database.execute("SELECT 1")).rejects.toMatchObject({
      code: "INVALID_IPC_RESULT",
    })
    await database.close()
  })

  it("keeps safe database error identity from invoke failures", async () => {
    const { database } = await openedDatabase((command) => {
      if (command === "database_health") {
        throw {
          code: "DATABASE_FAILURE",
          diagnosticId: "diag-1",
          message: "secret",
        }
      }
      return undefined
    })
    const error = await database.health().catch((value) => value)
    expect(error).toBeInstanceOf(TauriDatabaseError)
    expect(error).toMatchObject({
      code: "DATABASE_FAILURE",
      diagnosticId: "diag-1",
      message: "Database operation failed",
    })
    await database.close()
  })
})
