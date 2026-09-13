import { afterEach, describe, expect, it } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import { sqliteMigrations, SqliteMigrationRunner } from "../../src/migrations/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const V4_MIGRATIONS = sqliteMigrations.filter(({ version }) => version <= 4)
const V5_MIGRATIONS = sqliteMigrations.filter(({ version }) => version <= 5)

describe("investment migrations", () => {
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  async function createV4Database(): Promise<BetterSqliteDatabase> {
    database = new BetterSqliteDatabase()
    await configureSqliteConnection(database, { inMemory: true })
    await new SqliteMigrationRunner(database, V4_MIGRATIONS).migrate()
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
      ["book-1", "Main", "BRL", "America/Sao_Paulo", 0]
    )
    await database.executeBatch(
      "INSERT INTO ledger_accounts (id, book_id, name, normalized_name, kind, status, system_purpose, version, icon_key, color_hex) VALUES " +
        "('asset-active', 'book-1', 'Asset', 'asset', 'ASSET', 'ACTIVE', NULL, 0, NULL, NULL)," +
        "('asset-archived', 'book-1', 'Archived', 'archived', 'ASSET', 'ARCHIVED', NULL, 0, NULL, NULL)," +
        "('liability-active', 'book-1', 'Card', 'card', 'LIABILITY', 'ACTIVE', NULL, 0, NULL, NULL)," +
        "('system-asset', 'book-1', 'Opening', 'opening', 'ASSET', 'ACTIVE', 'OPENING_BALANCE', 0, NULL, NULL)," +
        "('income', 'book-1', 'Income', 'income', 'INCOME', 'ACTIVE', NULL, 0, 'label-dollar', '10b981');"
    )
    return database
  }

  async function migrate(): Promise<void> {
    await new SqliteMigrationRunner(database!, sqliteMigrations).migrate()
  }

  it("creates strict profile tables with book-scoped parent keys", async () => {
    database = new BetterSqliteDatabase()
    await configureSqliteConnection(database, { inMemory: true })
    await migrate()
    await expect(
      database.query<{ name: string; sql: string }>(
        "SELECT name, sql FROM sqlite_schema WHERE name IN ('financial_accounts', 'investment_accounts') ORDER BY name"
      )
    ).resolves.toEqual([
      expect.objectContaining({ name: "financial_accounts", sql: expect.stringContaining("STRICT") }),
      expect.objectContaining({ name: "investment_accounts", sql: expect.stringContaining("STRICT") }),
    ])
  })

  it("backfills active and archived non-system asset and liability accounts", async () => {
    await createV4Database()
    await migrate()
    await expect(
      database!.query<{ ledger_account_id: string; type: string }>(
        "SELECT ledger_account_id, type FROM financial_accounts ORDER BY ledger_account_id"
      )
    ).resolves.toEqual([
      { ledger_account_id: "asset-active", type: "OTHER_ASSET" },
      { ledger_account_id: "asset-archived", type: "OTHER_ASSET" },
      { ledger_account_id: "liability-active", type: "OTHER_LIABILITY" },
    ])
  })

  it("does not backfill categories or system accounts", async () => {
    await createV4Database()
    await migrate()
    await expect(
      database!.query("SELECT ledger_account_id FROM financial_accounts WHERE ledger_account_id IN ('income', 'system-asset')")
    ).resolves.toEqual([])
  })

  it("leaves pre-existing account versions and postings unchanged", async () => {
    await createV4Database()
    await database!.execute(
      "UPDATE ledger_accounts SET version = 7 WHERE id = 'asset-active'"
    )
    await migrate()
    await expect(
      database!.query<{ version: number }>("SELECT version FROM ledger_accounts WHERE id = 'asset-active'")
    ).resolves.toEqual([{ version: 7 }])
    await expect(database!.query("SELECT id FROM postings")).resolves.toEqual([])
  })

  it("rejects a profile whose type does not match the parent ledger kind", async () => {
    await createV4Database()
    await migrate()
    await expect(
      database!.execute("INSERT INTO financial_accounts (ledger_account_id, book_id, type) VALUES ('asset-active', 'book-1', 'CREDIT_CARD')")
    ).rejects.toThrow("financial account profile must match")
  })

  it("rejects profiles for system and category ledger accounts", async () => {
    await createV4Database()
    await migrate()
    await expect(
      database!.execute("INSERT INTO financial_accounts (ledger_account_id, book_id, type) VALUES ('system-asset', 'book-1', 'OTHER_ASSET')")
    ).rejects.toThrow("financial account profile must match")
    await expect(
      database!.execute("INSERT INTO financial_accounts (ledger_account_id, book_id, type) VALUES ('income', 'book-1', 'OTHER_ASSET')")
    ).rejects.toThrow("financial account profile must match")
  })

  it("allows an investment profile only for an investment account", async () => {
    await createV4Database()
    await migrate()
    await database!.execute("UPDATE financial_accounts SET type = 'INVESTMENT_ACCOUNT' WHERE ledger_account_id = 'asset-active'")
    await database!.execute("INSERT INTO investment_accounts (ledger_account_id, book_id) VALUES ('asset-active', 'book-1')")
    await expect(database!.query("SELECT ledger_account_id FROM investment_accounts")).resolves.toEqual([{ ledger_account_id: "asset-active" }])
  })

  it("rejects an investment child for another financial type", async () => {
    await createV4Database()
    await migrate()
    await expect(
      database!.execute("INSERT INTO investment_accounts (ledger_account_id, book_id) VALUES ('asset-active', 'book-1')")
    ).rejects.toThrow("investment profile requires")
  })

  it("rejects a settlement account from another book and the same investment account", async () => {
    await createV4Database()
    await migrate()
    await database!.execute("UPDATE financial_accounts SET type = 'INVESTMENT_ACCOUNT' WHERE ledger_account_id = 'asset-active'")
    await expect(
      database!.execute("INSERT INTO investment_accounts (ledger_account_id, book_id, default_settlement_account_id) VALUES ('asset-active', 'book-1', 'asset-active')")
    ).rejects.toThrow()
    await expect(
      database!.execute("INSERT INTO investment_accounts (ledger_account_id, book_id, default_settlement_account_id) VALUES ('asset-active', 'book-1', 'missing')")
    ).rejects.toThrow()
  })

  it("is repeatable after applying version five", async () => {
    await createV4Database()
    await migrate()
    await migrate()
    await expect(
      database!.query<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")
    ).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }])
  })

  it("rolls back version five tables, triggers and control row on failure", async () => {
    await createV4Database()
    const profileMigration = sqliteMigrations.find(({ version }) => version === 5)!
    await expect(
      new SqliteMigrationRunner(database!, [...V4_MIGRATIONS, { ...profileMigration, sql: profileMigration.sql + "\nINVALID SQL;" }]).migrate()
    ).rejects.toThrow()
    await expect(database!.query("SELECT name FROM sqlite_schema WHERE name IN ('financial_accounts', 'investment_accounts')")).resolves.toEqual([])
    await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }])
  })

  it("creates strict instruments and book-scoped identifier parents", async () => {
    await createV4Database()
    await migrate()
    await expect(
      database!.query<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_schema WHERE name IN ('investment_instruments', 'investment_instrument_identifiers') ORDER BY name")
    ).resolves.toEqual([
      expect.objectContaining({ name: "investment_instrument_identifiers", sql: expect.stringContaining("STRICT") }),
      expect.objectContaining({ name: "investment_instruments", sql: expect.stringContaining("STRICT") }),
    ])
  })

  async function createV5InstrumentDatabase(): Promise<void> {
    await createV4Database()
    await new SqliteMigrationRunner(database!, V5_MIGRATIONS).migrate()
  }

  async function insertInstrument(id = "instrument-1", bookId = "book-1"): Promise<void> {
    await database!.execute(
      "INSERT INTO investment_instruments (id, book_id, name, normalized_name, type, currency, status, version) VALUES (?, ?, ?, ?, 'CDB', 'BRL', 'ACTIVE', 0)",
      [id, bookId, id, id]
    )
  }

  it("stores a ticker with its required canonical market", async () => {
    await createV5InstrumentDatabase()
    await migrate()
    await insertInstrument()
    await database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-1', 'book-1', 'TICKER', 'PETR4', 'PETR4', 'B3')")
    await expect(database!.query("SELECT scheme, normalized_value, market FROM investment_instrument_identifiers")).resolves.toEqual([{ scheme: "TICKER", normalized_value: "PETR4", market: "B3" }])
  })

  it("stores ISIN with the empty canonical market", async () => {
    await createV5InstrumentDatabase()
    await migrate()
    await insertInstrument()
    await database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-1', 'book-1', 'ISIN', 'BR123', 'BR123', '')")
    await expect(database!.query("SELECT market FROM investment_instrument_identifiers")).resolves.toEqual([{ market: "" }])
  })

  it("rejects ticker without a market and a non-ticker with a market", async () => {
    await createV5InstrumentDatabase()
    await migrate()
    await insertInstrument()
    await expect(database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-1', 'book-1', 'TICKER', 'PETR4', 'PETR4', '')")).rejects.toThrow()
    await expect(database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-1', 'book-1', 'ISIN', 'BR123', 'BR123', 'B3')")).rejects.toThrow()
  })

  it("rejects an identifier collision within a book and scheme", async () => {
    await createV5InstrumentDatabase()
    await migrate()
    await insertInstrument("instrument-1")
    await insertInstrument("instrument-2")
    await database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-1', 'book-1', 'ISIN', 'BR123', 'BR123', '')")
    await expect(database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-2', 'book-1', 'ISIN', 'BR123', 'BR123', '')")).rejects.toThrow()
  })

  it("rejects an identifier that points to an instrument in another book", async () => {
    await createV5InstrumentDatabase()
    await database!.execute("INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES ('book-2', 'Other', 'BRL', 'America/Sao_Paulo', 0)")
    await migrate()
    await insertInstrument("instrument-2", "book-2")
    await expect(database!.execute("INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) VALUES ('instrument-2', 'book-1', 'ISIN', 'BR123', 'BR123', '')")).rejects.toThrow()
  })

  it("rejects invalid instrument type, currency and lifecycle fields", async () => {
    await createV5InstrumentDatabase()
    await migrate()
    for (const values of [
      ["bad-type", "NOT_A_TYPE", "BRL", "ACTIVE"],
      ["bad-currency", "CDB", "brl", "ACTIVE"],
      ["bad-status", "CDB", "BRL", "DELETED"],
    ]) {
      await expect(database!.execute("INSERT INTO investment_instruments (id, book_id, name, normalized_name, type, currency, status, version) VALUES (?, 'book-1', ?, ?, ?, ?, ?, 0)", [values[0], values[0], values[0], values[1], values[2], values[3]])).rejects.toThrow()
    }
  })

  it("is repeatable after applying version six", async () => {
    await createV5InstrumentDatabase()
    await migrate()
    await migrate()
    await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }])
  })

  it("rolls back version six schema and its control row on failure", async () => {
    await createV5InstrumentDatabase()
    const migration = sqliteMigrations.find(({ version }) => version === 6)!
    await expect(new SqliteMigrationRunner(database!, [...V5_MIGRATIONS, { ...migration, sql: migration.sql + "\nINVALID SQL;" }]).migrate()).rejects.toThrow()
    await expect(database!.query("SELECT name FROM sqlite_schema WHERE name IN ('investment_instruments', 'investment_instrument_identifiers')")).resolves.toEqual([])
    await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }])
  })
})
