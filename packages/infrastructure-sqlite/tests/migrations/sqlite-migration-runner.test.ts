import { afterEach, describe, expect, it, vi } from "vitest"
import type { SqliteDatabase } from "../../src/database/sqlite-database.js"
import {
  InvalidMigrationPlanError,
  ModifiedMigrationError,
  SqliteMigrationRunner,
  UnknownAppliedMigrationError,
} from "../../src/migrations/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

type Migration = {
  version: number
  name: string
  checksum: string
  sql: string
}

const migration = (
  version: number,
  sql: string,
  checksum = "checksum-" + version
): Migration => ({
  version,
  name: "migration_" + version,
  checksum,
  sql,
})

const CREATE_SCHEMA_MIGRATIONS_SQL = [
  "CREATE TABLE IF NOT EXISTS schema_migrations (",
  "  version INTEGER PRIMARY KEY CHECK (version >= 1),",
  "  name TEXT NOT NULL CHECK (length(trim(name)) > 0),",
  "  checksum TEXT NOT NULL CHECK (length(trim(checksum)) > 0),",
  "  applied_at TEXT NOT NULL CHECK (length(trim(applied_at)) > 0)",
  ") STRICT;",
].join("\n")

function tauriIntegerOutput(database: BetterSqliteDatabase): SqliteDatabase {
  return {
    query: async <Row extends Record<string, unknown>>(
      sql: string,
      parameters
    ) => {
      const rows = await database.query<Row>(sql, parameters)
      if (!sql.includes("FROM schema_migrations")) {
        return rows
      }

      return rows.map((row) =>
        typeof row.version === "number"
          ? { ...row, version: String(row.version) }
          : row
      ) as Row[]
    },
    execute: database.execute.bind(database),
    executeBatch: database.executeBatch.bind(database),
    transaction: database.transaction.bind(database),
    readTransaction: database.readTransaction.bind(database),
    close: database.close.bind(database),
  }
}

describe("SqliteMigrationRunner", () => {
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  it("rejects an invalid plan before touching the database", async () => {
    const transaction = vi.fn()
    const fakeDatabase = { transaction } as unknown as SqliteDatabase
    const runner = new SqliteMigrationRunner(fakeDatabase, [
      migration(2, "SELECT 1;"),
      migration(1, "SELECT 1;"),
    ])

    await expect(runner.migrate()).rejects.toBeInstanceOf(
      InvalidMigrationPlanError
    )
    expect(transaction).not.toHaveBeenCalled()
  })

  it("creates a strict schema_migrations table on an empty database", async () => {
    database = new BetterSqliteDatabase()
    const runner = new SqliteMigrationRunner(database, [])

    await runner.migrate()

    const rows = await database.query<{ sql: string }>(
      "SELECT sql FROM sqlite_schema WHERE name = 'schema_migrations'"
    )
    expect(rows[0]?.sql).toContain("STRICT")
  })

  it("applies migrations in version order and records their metadata", async () => {
    database = new BetterSqliteDatabase()
    const runner = new SqliteMigrationRunner(database, [
      migration(
        1,
        "CREATE TABLE records (name TEXT);" +
          "INSERT INTO records (name) VALUES ('first');"
      ),
      migration(2, "INSERT INTO records (name) VALUES ('second');"),
    ])

    await runner.migrate()

    expect(
      await database.query<{ name: string }>(
        "SELECT name FROM records ORDER BY rowid"
      )
    ).toEqual([{ name: "first" }, { name: "second" }])
    expect(
      await database.query<{ version: number; checksum: string }>(
        "SELECT version, checksum FROM schema_migrations ORDER BY version"
      )
    ).toEqual([
      { version: 1, checksum: "checksum-1" },
      { version: 2, checksum: "checksum-2" },
    ])
  })

  it("rejects an applied version absent from the current plan before pending SQL", async () => {
    database = new BetterSqliteDatabase()
    await database.executeBatch(CREATE_SCHEMA_MIGRATIONS_SQL)
    await database.execute(
      "INSERT INTO schema_migrations " +
        "(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
      [9, "unknown", "checksum-9", "2026-08-04T00:00:00.000Z"]
    )
    const runner = new SqliteMigrationRunner(database, [
      migration(1, "CREATE TABLE pending (id INTEGER);"),
    ])

    await expect(runner.migrate()).rejects.toBeInstanceOf(
      UnknownAppliedMigrationError
    )
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name = 'pending'"
      )
    ).toEqual([])
  })

  it("rejects a modified checksum before applying pending SQL", async () => {
    database = new BetterSqliteDatabase()
    await database.executeBatch(CREATE_SCHEMA_MIGRATIONS_SQL)
    await database.execute(
      "INSERT INTO schema_migrations " +
        "(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
      [1, "migration_1", "old-checksum", "2026-08-04T00:00:00.000Z"]
    )
    const runner = new SqliteMigrationRunner(database, [
      migration(1, "CREATE TABLE pending (id INTEGER);"),
      migration(2, "CREATE TABLE later (id INTEGER);"),
    ])

    await expect(runner.migrate()).rejects.toBeInstanceOf(
      ModifiedMigrationError
    )
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name IN ('pending', 'later')"
      )
    ).toEqual([])
  })

  it("makes a second run a no-op", async () => {
    database = new BetterSqliteDatabase()
    const runner = new SqliteMigrationRunner(database, [
      migration(1, "CREATE TABLE only_once (id INTEGER);"),
    ])

    await runner.migrate()
    await runner.migrate()

    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name = 'only_once'"
      )
    ).toEqual([{ name: "only_once" }])
    expect(
      await database.query("SELECT version FROM schema_migrations")
    ).toEqual([{ version: 1 }])
  })

  it("accepts applied versions encoded as strings by the Tauri IPC adapter", async () => {
    database = new BetterSqliteDatabase()
    const migrations = [migration(1, "CREATE TABLE only_once (id INTEGER);")]

    await new SqliteMigrationRunner(database, migrations).migrate()
    await new SqliteMigrationRunner(
      tauriIntegerOutput(database),
      migrations
    ).migrate()

    expect(
      await database.query("SELECT version FROM schema_migrations")
    ).toEqual([{ version: 1 }])
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name = 'only_once'"
      )
    ).toEqual([{ name: "only_once" }])
  })

  it("rolls back a failed migration and its control row", async () => {
    database = new BetterSqliteDatabase()
    const runner = new SqliteMigrationRunner(database, [
      migration(
        1,
        "CREATE TABLE transient (id INTEGER);" + "THIS IS NOT VALID SQL;"
      ),
    ])

    await expect(runner.migrate()).rejects.toThrow()
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name = 'transient'"
      )
    ).toEqual([])
    expect(
      await database.query("SELECT version FROM schema_migrations")
    ).toEqual([])
  })

  it("keeps prior migrations committed when a later migration fails", async () => {
    database = new BetterSqliteDatabase()
    const runner = new SqliteMigrationRunner(database, [
      migration(1, "CREATE TABLE first (id INTEGER);"),
      migration(2, "CREATE TABLE second (id INTEGER); THIS IS INVALID;"),
    ])

    await expect(runner.migrate()).rejects.toThrow()
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name IN ('first', 'second')"
      )
    ).toEqual([{ name: "first" }])
    expect(
      await database.query("SELECT version FROM schema_migrations")
    ).toEqual([{ version: 1 }])
  })

  it("stores name, checksum and applied timestamp in the committed row", async () => {
    database = new BetterSqliteDatabase()
    const runner = new SqliteMigrationRunner(database, [
      migration(1, "CREATE TABLE records (id INTEGER);"),
    ])

    await runner.migrate()

    const rows = await database.query<{
      name: string
      checksum: string
      applied_at: string
    }>("SELECT name, checksum, applied_at FROM schema_migrations")
    expect(rows).toEqual([
      {
        name: "migration_1",
        checksum: "checksum-1",
        applied_at: expect.any(String),
      },
    ])
  })

  it("skips an applied version and applies only the next pending migration", async () => {
    database = new BetterSqliteDatabase()
    await database.executeBatch(CREATE_SCHEMA_MIGRATIONS_SQL)
    await database.executeBatch("CREATE TABLE first (id INTEGER);")
    await database.execute(
      "INSERT INTO schema_migrations " +
        "(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
      [1, "migration_1", "checksum-1", "2026-08-04T00:00:00.000Z"]
    )
    const runner = new SqliteMigrationRunner(database, [
      migration(1, "THIS MUST NOT RUN;"),
      migration(2, "CREATE TABLE second (id INTEGER);"),
    ])

    await runner.migrate()

    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name IN ('first', 'second')"
      )
    ).toEqual([{ name: "first" }, { name: "second" }])
    expect(
      await database.query(
        "SELECT version FROM schema_migrations ORDER BY version"
      )
    ).toEqual([{ version: 1 }, { version: 2 }])
  })
})
