import { afterEach, describe, expect, it } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import {
  sqliteMigrations,
  SqliteMigrationRunner,
} from "../../src/migrations/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const V1_TO_V3 = sqliteMigrations.filter(({ version }) => version <= 3)
const CATEGORY_MIGRATION = () =>
  sqliteMigrations.find(({ version }) => version === 4)!

describe("category visual metadata migration", () => {
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  async function createV3Database(): Promise<BetterSqliteDatabase> {
    database = new BetterSqliteDatabase()
    await configureSqliteConnection(database, { inMemory: true })
    await new SqliteMigrationRunner(database, V1_TO_V3).migrate()
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
        "VALUES (?, ?, ?, ?, ?)",
      ["book-1", "Main book", "BRL", "America/Sao_Paulo", 0]
    )
    await database.executeBatch(
      "INSERT INTO ledger_accounts " +
        "(id, book_id, name, normalized_name, kind, status, system_purpose, version) VALUES " +
        "('income-1', 'book-1', 'Salary', 'salary', 'INCOME', 'ACTIVE', NULL, 0)," +
        "('expense-1', 'book-1', 'Food', 'food', 'EXPENSE', 'ACTIVE', NULL, 0)," +
        "('asset-1', 'book-1', 'Cash', 'cash', 'ASSET', 'ACTIVE', NULL, 0)," +
        "('system-1', 'book-1', 'Opening', 'opening', 'ASSET', 'ACTIVE', 'OPENING_BALANCE', 0);"
    )
    return database
  }

  async function migrateCategoryMetadata(): Promise<void> {
    await new SqliteMigrationRunner(database!, sqliteMigrations).migrate()
  }

  it("adds nullable visual columns and exact kind-specific backfills", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    const columns = await database!.query<{
      name: string
      notnull: number
    }>("PRAGMA table_info(ledger_accounts)")
    expect(
      columns
        .filter(({ name }) => name === "icon_key" || name === "color_hex")
        .map(({ name, notnull }) => ({ name, notnull }))
    ).toEqual([
      { name: "icon_key", notnull: 0 },
      { name: "color_hex", notnull: 0 },
    ])
    await expect(
      database!.query<{ id: string; icon_key: string; color_hex: string }>(
        "SELECT id, icon_key, color_hex FROM ledger_accounts ORDER BY id"
      )
    ).resolves.toEqual([
      { id: "asset-1", icon_key: null, color_hex: null },
      { id: "expense-1", icon_key: "label-dollar", color_hex: "f43f5e" },
      { id: "income-1", icon_key: "label-dollar", color_hex: "10b981" },
      { id: "system-1", icon_key: null, color_hex: null },
    ])
  })

  it("rejects missing, empty and malformed metadata on managed inserts", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    const invalidRows = [
      ["missing", null, "f43f5e"],
      ["empty-icon", "", "f43f5e"],
      ["hash-color", "food", "#f43f5e"],
      ["upper-color", "food", "F43F5E"],
      ["bad-slug", "Food Icon", "f43f5e"],
    ] as const

    for (const [id, iconKey, colorHex] of invalidRows) {
      await expect(
        database!.execute(
          "INSERT INTO ledger_accounts " +
            "(id, book_id, name, normalized_name, kind, status, system_purpose, version, icon_key, color_hex) " +
            "VALUES (?, 'book-1', ?, ?, 'EXPENSE', 'ACTIVE', NULL, 0, ?, ?)",
          [id, id, id, iconKey, colorHex]
        )
      ).rejects.toThrow()
    }
  })

  it("rejects double hyphens and edge hyphens in icon slugs", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    for (const iconKey of ["-food", "food-", "food--icon", "food/icon"]) {
      await expect(
        database!.execute(
          "INSERT INTO ledger_accounts " +
            "(id, book_id, name, normalized_name, kind, status, system_purpose, version, icon_key, color_hex) " +
            "VALUES (?, 'book-1', 'Invalid', ?, 'EXPENSE', 'ACTIVE', NULL, 0, ?, 'f43f5e')",
          ["bad-" + iconKey, "bad-" + iconKey, iconKey]
        )
      ).rejects.toThrow()
    }
  })

  it("rejects visual metadata on financial and system accounts", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    await expect(
      database!.execute(
        "INSERT INTO ledger_accounts " +
          "(id, book_id, name, normalized_name, kind, status, system_purpose, version, icon_key, color_hex) " +
          "VALUES ('asset-2', 'book-1', 'Bank', 'bank', 'ASSET', 'ACTIVE', NULL, 0, 'bank', '10b981')"
      )
    ).rejects.toThrow()
    await expect(
      database!.execute(
        "UPDATE ledger_accounts SET icon_key = 'opening' WHERE id = 'system-1'"
      )
    ).rejects.toThrow()
  })

  it("rejects incomplete or invalid metadata on managed updates", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    for (const [column, value] of [
      ["icon_key", null],
      ["color_hex", null],
      ["color_hex", "123"],
      ["icon_key", "Bad Icon"],
    ] as const) {
      await expect(
        database!.execute(
          `UPDATE ledger_accounts SET ${column} = ? WHERE id = 'expense-1'`,
          [value]
        )
      ).rejects.toThrow()
    }
  })

  it("rejects a transition to managed without metadata and preserves the row", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    await expect(
      database!.execute(
        "UPDATE ledger_accounts SET kind = 'EXPENSE' WHERE id = 'asset-1'"
      )
    ).rejects.toThrow()
    await expect(
      database!.query(
        "SELECT kind, icon_key, color_hex FROM ledger_accounts WHERE id = 'asset-1'"
      )
    ).resolves.toEqual([{ kind: "ASSET", icon_key: null, color_hex: null }])
  })

  it("rejects a transition to non-managed while metadata is present", async () => {
    await createV3Database()
    await migrateCategoryMetadata()

    await expect(
      database!.execute(
        "UPDATE ledger_accounts SET kind = 'ASSET' WHERE id = 'expense-1'"
      )
    ).rejects.toThrow()
    await expect(
      database!.query(
        "SELECT kind, icon_key, color_hex FROM ledger_accounts WHERE id = 'expense-1'"
      )
    ).resolves.toEqual([
      { kind: "EXPENSE", icon_key: "label-dollar", color_hex: "f43f5e" },
    ])
  })

  it("makes migration application idempotent", async () => {
    await createV3Database()
    await migrateCategoryMetadata()
    await migrateCategoryMetadata()

    await expect(
      database!.query<{ version: number }>(
        "SELECT version FROM schema_migrations ORDER BY version"
      )
    ).resolves.toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
    ])
    await expect(
      database!.query("SELECT id FROM ledger_accounts ORDER BY id")
    ).resolves.toHaveLength(4)
  })

  it("rolls back columns, rows, triggers and migration metadata on failure", async () => {
    await createV3Database()
    const broken = {
      ...CATEGORY_MIGRATION(),
      sql: CATEGORY_MIGRATION().sql + "\nTHIS IS INVALID SQL;\n",
    }

    await expect(
      new SqliteMigrationRunner(database!, [...V1_TO_V3, broken]).migrate()
    ).rejects.toThrow()
    await expect(
      database!.query<{ name: string }>("PRAGMA table_info(ledger_accounts)")
    ).resolves.not.toEqual(expect.arrayContaining([{ name: "icon_key" }]))
    await expect(
      database!.query<{ name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND name LIKE 'trg_category_visual_metadata_%'"
      )
    ).resolves.toEqual([])
    await expect(
      database!.query<{ version: number }>(
        "SELECT version FROM schema_migrations ORDER BY version"
      )
    ).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }])
    await expect(
      database!.query<{ id: string }>(
        "SELECT id FROM ledger_accounts WHERE id IN ('income-1', 'expense-1') ORDER BY id"
      )
    ).resolves.toEqual([{ id: "expense-1" }, { id: "income-1" }])
  })
})
