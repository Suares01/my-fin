import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  backfillJournalSearch,
  initializeSqliteDatabase,
} from "../../src/database/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

describe("initializeSqliteDatabase", () => {
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

  it("configures and migrates an in-memory database", async () => {
    database = new BetterSqliteDatabase()

    await initializeSqliteDatabase(database, { inMemory: true })

    expect(
      await database.query<{ foreign_keys: number }>("PRAGMA foreign_keys")
    ).toEqual([{ foreign_keys: 1 }])
    expect(
      await database.query<{ timeout: number }>("PRAGMA busy_timeout")
    ).toEqual([{ timeout: 5000 }])
    expect(
      await database.query<{ version: number }>(
        "SELECT version FROM schema_migrations"
      )
    ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name = 'postings'"
      )
    ).toEqual([{ name: "postings" }])
  })

  it("configures WAL and migrates a file database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "open-coin-sqlite-init-"))
    temporaryDirectories.push(directory)
    database = new BetterSqliteDatabase(join(directory, "ledger.sqlite"))

    await initializeSqliteDatabase(database, { inMemory: false })

    expect(
      await database.query<{ journal_mode: string }>("PRAGMA journal_mode")
    ).toEqual([{ journal_mode: "wal" }])
    expect(
      await database.query<{ synchronous: number }>("PRAGMA synchronous")
    ).toEqual([{ synchronous: 2 }])
    expect(
      await database.query<{ version: number }>(
        "SELECT version FROM schema_migrations"
      )
    ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
  })

  it("runs an explicitly supplied migration list in version order", async () => {
    database = new BetterSqliteDatabase()

    await initializeSqliteDatabase(database, {
      inMemory: true,
      migrations: [
        {
          version: 1,
          name: "first",
          checksum: "checksum-first",
          sql:
            "CREATE TABLE initialization_order (position INTEGER);" +
            "INSERT INTO initialization_order (position) VALUES (1);",
        },
        {
          version: 2,
          name: "second",
          checksum: "checksum-second",
          sql: "INSERT INTO initialization_order (position) VALUES (2);",
        },
      ],
    })

    expect(
      await database.query<{ position: number }>(
        "SELECT position FROM initialization_order ORDER BY position"
      )
    ).toEqual([{ position: 1 }, { position: 2 }])
    expect(
      await database.query<{ version: number }>(
        "SELECT version FROM schema_migrations ORDER BY version"
      )
    ).toEqual([{ version: 1 }, { version: 2 }])
  })

  it("makes repeated initialization preserve the migration history", async () => {
    database = new BetterSqliteDatabase()

    await initializeSqliteDatabase(database, { inMemory: true })
    await initializeSqliteDatabase(database, { inMemory: true })

    expect(
      await database.query<{ version: number; applied_at: string }>(
        "SELECT version, applied_at FROM schema_migrations"
      )
    ).toEqual([
      { version: 1, applied_at: expect.any(String) },
      { version: 2, applied_at: expect.any(String) },
      { version: 3, applied_at: expect.any(String) },
    ])
    expect(
      await database.query(
        "SELECT name FROM sqlite_schema WHERE name = 'financial_books'"
      )
    ).toEqual([{ name: "financial_books" }])
  })

  it("verifies pragmas after configuration and before migrations", async () => {
    database = new BetterSqliteDatabase()
    const events: string[] = []
    const executeBatch = database.executeBatch.bind(database)
    const query = database.query.bind(database)

    vi.spyOn(database, "executeBatch").mockImplementation(async (sql) => {
      events.push("configure")
      await executeBatch(sql)
    })
    vi.spyOn(database, "query").mockImplementation(async (sql, parameters) => {
      if (sql.startsWith("PRAGMA ")) {
        events.push("verify")
      } else if (sql.includes("schema_migrations")) {
        events.push("migrate")
      }
      return query(sql, parameters)
    })

    await initializeSqliteDatabase(database, { inMemory: true })

    expect(events.indexOf("configure")).toBeGreaterThanOrEqual(0)
    expect(events.indexOf("verify")).toBeGreaterThan(
      events.indexOf("configure")
    )
    expect(events.indexOf("migrate")).toBeGreaterThan(events.indexOf("verify"))
  })

  it("backfills Unicode descriptions and marks each row complete", async () => {
    database = new BetterSqliteDatabase()

    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
        "VALUES (?, ?, ?, ?, ?)",
      ["book-backfill", "Backfill", "BRL", "America/Sao_Paulo", 0]
    )
    await database.execute(
      "INSERT INTO journal_entries " +
        "(id, book_id, occurred_on, recorded_at, sequence, description, currency, origin, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "entry-backfill",
        "book-backfill",
        "2026-08-11",
        "2026-08-11T12:00:00.000Z",
        "1",
        "  Café  ",
        "BRL",
        "MANUAL",
        0,
      ]
    )

    await initializeSqliteDatabase(database, { inMemory: true })

    expect(
      await database.query(
        "SELECT search_text, search_version FROM journal_entries"
      )
    ).toEqual([{ search_text: "café", search_version: 1 }])
  })

  it("resumes after a committed batch without rewriting completed rows", async () => {
    database = new BetterSqliteDatabase()

    await initializeSqliteDatabase(database, { inMemory: true })
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
      ["book-resume", "Resume", "BRL", "UTC", 0]
    )
    for (const [id, description, sequence] of [
      ["entry-a", "  Água ", "1"],
      ["entry-b", "  Óleo ", "2"],
      ["entry-c", "  Pão ", "3"],
    ]) {
      await database.execute(
        "INSERT INTO journal_entries " +
          "(id, book_id, occurred_on, recorded_at, sequence, description, currency, origin, version) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          "book-resume",
          "2026-08-11",
          "2026-08-11T12:00:00.000Z",
          sequence,
          description,
          "BRL",
          "MANUAL",
          0,
        ]
      )
    }

    await backfillJournalSearch(database, { batchSize: 2 })
    const completed = await database.query(
      "SELECT id, search_text, search_version FROM journal_entries ORDER BY id"
    )
    await backfillJournalSearch(database, { batchSize: 1 })

    expect(completed).toEqual([
      { id: "entry-a", search_text: "água", search_version: 1 },
      { id: "entry-b", search_text: "óleo", search_version: 1 },
      { id: "entry-c", search_text: "pão", search_version: 1 },
    ])
    expect(
      await database.query(
        "SELECT id, search_text, search_version FROM journal_entries ORDER BY id"
      )
    ).toEqual(completed)
  })

  it("does not run a backfill against custom schemas without search columns", async () => {
    database = new BetterSqliteDatabase()

    await expect(
      initializeSqliteDatabase(database, {
        inMemory: true,
        migrations: [
          {
            version: 1,
            name: "custom",
            checksum: "custom-checksum",
            sql: "CREATE TABLE custom_initialization (id TEXT NOT NULL);",
          },
        ],
      })
    ).resolves.toBeUndefined()
  })

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid batch size %s",
    async (batchSize) => {
      database = new BetterSqliteDatabase()
      await expect(
        backfillJournalSearch(database, { batchSize })
      ).rejects.toThrow("batchSize must be positive")
    }
  )
})
