import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  SQLITE_PRAGMA_MISMATCH,
  SqlitePragmaVerificationError,
  verifySqliteConnection,
} from "../../src/database/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type PragmaValues = {
  foreign_keys: number
  timeout: number
  journal_mode: string
  synchronous: number
}

function fakeReader(
  values: Partial<PragmaValues> = {},
  options: { readonly integerValuesAsStrings?: boolean } = {}
) {
  const resolved: PragmaValues = {
    foreign_keys: 1,
    timeout: 5000,
    journal_mode: "wal",
    synchronous: 2,
    ...values,
  }
  const query = vi.fn(async (statement: string) => {
    const requested = statement.replace("PRAGMA ", "")
    const column = (
      requested === "busy_timeout" ? "timeout" : requested
    ) as keyof PragmaValues
    const value = resolved[column]
    return [
      {
        [column]:
          options.integerValuesAsStrings && typeof value === "number"
            ? String(value)
            : value,
      },
    ]
  })
  return { query }
}

describe("verifySqliteConnection", () => {
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

  it("accepts foreign keys for memory connections", async () => {
    const reader = fakeReader()

    await expect(
      verifySqliteConnection(reader, { inMemory: true })
    ).resolves.toBeUndefined()
    expect(reader.query).toHaveBeenCalledWith("PRAGMA foreign_keys")
  })

  it("accepts the busy timeout for memory connections", async () => {
    const reader = fakeReader()

    await verifySqliteConnection(reader, { inMemory: true })

    expect(reader.query).toHaveBeenCalledWith("PRAGMA busy_timeout")
  })

  it("does not require file-only pragmas for memory connections", async () => {
    const reader = fakeReader()

    await verifySqliteConnection(reader, { inMemory: true })

    expect(reader.query).toHaveBeenCalledTimes(2)
    expect(reader.query.mock.calls.map(([statement]) => statement)).toEqual([
      "PRAGMA foreign_keys",
      "PRAGMA busy_timeout",
    ])
  })

  it("accepts WAL for file connections", async () => {
    const reader = fakeReader()

    await verifySqliteConnection(reader, { inMemory: false })

    expect(reader.query).toHaveBeenCalledWith("PRAGMA journal_mode")
  })

  it("accepts FULL synchronous mode for file connections", async () => {
    const reader = fakeReader()

    await verifySqliteConnection(reader, { inMemory: false })

    expect(reader.query).toHaveBeenCalledWith("PRAGMA synchronous")
  })

  it("accepts integer pragmas encoded as strings by the Tauri IPC adapter", async () => {
    const reader = fakeReader({}, { integerValuesAsStrings: true })

    await expect(
      verifySqliteConnection(reader, { inMemory: false })
    ).resolves.toBeUndefined()
  })

  it("rejects a foreign-key mismatch with a stable safe error", async () => {
    const reader = fakeReader({ foreign_keys: 0 })

    await expect(
      verifySqliteConnection(reader, { inMemory: true })
    ).rejects.toMatchObject({
      code: SQLITE_PRAGMA_MISMATCH,
      message: "SQLite connection pragmas failed verification",
    })
  })

  it("rejects a busy-timeout mismatch without exposing SQL", async () => {
    const reader = fakeReader({ timeout: 1000 })

    await expect(
      verifySqliteConnection(reader, { inMemory: true })
    ).rejects.toBeInstanceOf(SqlitePragmaVerificationError)
  })

  it("rejects a journal-mode mismatch before migrations can run", async () => {
    const reader = fakeReader({ journal_mode: "delete" })

    await expect(
      verifySqliteConnection(reader, { inMemory: false })
    ).rejects.toMatchObject({
      code: SQLITE_PRAGMA_MISMATCH,
    })
    expect(reader.query).toHaveBeenCalledTimes(3)
  })

  it("rejects a synchronous-mode mismatch", async () => {
    const reader = fakeReader({ synchronous: 1 })

    await expect(
      verifySqliteConnection(reader, { inMemory: false })
    ).rejects.toBeInstanceOf(SqlitePragmaVerificationError)
  })

  it("sanitizes a driver failure and preserves no path or SQL", async () => {
    const reader = {
      query: vi
        .fn()
        .mockRejectedValue(
          new Error("PRAGMA synchronous at /private/secret/ledger.sqlite")
        ),
    }

    const error = await verifySqliteConnection(reader, {
      inMemory: false,
    }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      code: SQLITE_PRAGMA_MISMATCH,
      message: "SQLite connection pragmas failed verification",
    })
    expect(String(error)).not.toContain("ledger.sqlite")
  })

  it("verifies a real memory database against the configured invariants", async () => {
    database = new BetterSqliteDatabase(":memory:")

    await database.executeBatch(
      "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;"
    )

    await expect(
      verifySqliteConnection(database, { inMemory: true })
    ).resolves.toBeUndefined()
  })

  it("verifies a real file database against the configured invariants", async () => {
    const directory = await mkdtemp(join(tmpdir(), "open-coin-sqlite-verify-"))
    temporaryDirectories.push(directory)
    database = new BetterSqliteDatabase(join(directory, "ledger.sqlite"))

    await database.executeBatch(
      "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;" +
        "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;"
    )

    await expect(
      verifySqliteConnection(database, { inMemory: false })
    ).resolves.toBeUndefined()
  })
})
