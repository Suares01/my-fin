import { afterEach, describe, expect, it } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import {
  sqliteMigrations,
  SqliteMigrationRunner,
} from "../../src/migrations/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const V1_ONLY = [sqliteMigrations[0]!]

describe("financial query migrations", () => {
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  async function createFreshDatabase(): Promise<BetterSqliteDatabase> {
    database = new BetterSqliteDatabase()
    await configureSqliteConnection(database, { inMemory: true })
    return database
  }

  it("keeps generated migrations contiguous and checksummed", () => {
    expect(
      sqliteMigrations.map(({ version, name }) => ({ version, name }))
    ).toEqual([
      { version: 1, name: "initial_financial_ledger" },
      { version: 2, name: "financial_query_indexes" },
      { version: 3, name: "journal_amendment_search" },
      { version: 4, name: "category_visual_metadata" },
      { version: 5, name: "financial_account_profiles" },
    ])
    expect(
      sqliteMigrations.every(({ checksum }) => /^[a-f0-9]{64}$/.test(checksum))
    ).toBe(true)
  })

  it("upgrades a database with V1 applied to the current schema", async () => {
    const current = await createFreshDatabase()
    await new SqliteMigrationRunner(current, V1_ONLY).migrate()
    await new SqliteMigrationRunner(current, sqliteMigrations).migrate()

    await expect(
      current.query<{ version: number; name: string }>(
        "SELECT version, name FROM schema_migrations ORDER BY version"
      )
    ).resolves.toEqual([
      { version: 1, name: "initial_financial_ledger" },
      { version: 2, name: "financial_query_indexes" },
      { version: 3, name: "journal_amendment_search" },
      { version: 4, name: "category_visual_metadata" },
      { version: 5, name: "financial_account_profiles" },
    ])
  })

  it("makes applying the complete plan twice a no-op", async () => {
    const current = await createFreshDatabase()
    const runner = new SqliteMigrationRunner(current, sqliteMigrations)

    await runner.migrate()
    await runner.migrate()

    await expect(
      current.query<{ version: number }>(
        "SELECT version FROM schema_migrations ORDER BY version"
      )
    ).resolves.toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ])
  })

  it("rejects a tampered V2 checksum before changing the schema", async () => {
    const current = await createFreshDatabase()
    await new SqliteMigrationRunner(current, V1_ONLY).migrate()
    await current.execute(
      "UPDATE schema_migrations SET checksum = ? WHERE version = ?",
      ["tampered", 1]
    )

    await expect(
      new SqliteMigrationRunner(current, sqliteMigrations).migrate()
    ).rejects.toThrow("Migration version 1 has a different checksum")
    await expect(
      current.query("SELECT name FROM sqlite_schema WHERE name = ?", [
        "ix_journal_entries_book_date_sequence_numeric",
      ])
    ).resolves.toEqual([])
  })

  it("adds lineage, search and same-book integrity objects", async () => {
    const current = await createFreshDatabase()
    await new SqliteMigrationRunner(current, sqliteMigrations).migrate()

    const columns = await current.query<{
      name: string
      notnull: number
      dflt_value: string | null
    }>("PRAGMA table_info(journal_entries)")
    expect(
      columns
        .filter(({ name }) =>
          [
            "replacement_of_id",
            "replaced_by_id",
            "search_text",
            "search_version",
          ].includes(name)
        )
        .map(({ name, notnull, dflt_value }) => ({ name, notnull, dflt_value }))
    ).toEqual([
      { name: "replacement_of_id", notnull: 0, dflt_value: null },
      { name: "replaced_by_id", notnull: 0, dflt_value: null },
      { name: "search_text", notnull: 1, dflt_value: "''" },
      { name: "search_version", notnull: 1, dflt_value: "0" },
    ])

    const indexes = await current.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'index' AND name IN (?, ?, ?)",
      [
        "ux_journal_entries_replacement_of",
        "ux_journal_entries_replaced_by",
        "ix_journal_entries_book_search",
      ]
    )
    expect(indexes.map(({ name }) => name).sort()).toEqual([
      "ix_journal_entries_book_search",
      "ux_journal_entries_replaced_by",
      "ux_journal_entries_replacement_of",
    ])

    const triggers = await current.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND name LIKE 'trg_journal_entries_%_same_book_%'"
    )
    expect(triggers.map(({ name }) => name).sort()).toEqual([
      "trg_journal_entries_replaced_by_same_book_insert",
      "trg_journal_entries_replaced_by_same_book_update",
      "trg_journal_entries_replacement_of_same_book_insert",
      "trg_journal_entries_replacement_of_same_book_update",
    ])
  })
})
