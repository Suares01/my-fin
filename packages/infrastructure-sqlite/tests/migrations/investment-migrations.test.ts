import { afterEach, describe, expect, it } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import { sqliteMigrations, SqliteMigrationRunner } from "../../src/migrations/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const V4_MIGRATIONS = sqliteMigrations.filter(({ version }) => version <= 4)
const V5_MIGRATIONS = sqliteMigrations.filter(({ version }) => version <= 5)
const V6_MIGRATIONS = sqliteMigrations.filter(({ version }) => version <= 6)

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
    ).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }, { version: 8 }, { version: 9 }])
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
    await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }, { version: 8 }, { version: 9 }])
  })

  it("rolls back version six schema and its control row on failure", async () => {
    await createV5InstrumentDatabase()
    const migration = sqliteMigrations.find(({ version }) => version === 6)!
    await expect(new SqliteMigrationRunner(database!, [...V5_MIGRATIONS, { ...migration, sql: migration.sql + "\nINVALID SQL;" }]).migrate()).rejects.toThrow()
    await expect(database!.query("SELECT name FROM sqlite_schema WHERE name IN ('investment_instruments', 'investment_instrument_identifiers')")).resolves.toEqual([])
    await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }])
  })

  async function createV6PositionDatabase(): Promise<void> {
    await createV4Database()
    await new SqliteMigrationRunner(database!, V6_MIGRATIONS).migrate()
    await database!.execute("UPDATE financial_accounts SET type = 'INVESTMENT_ACCOUNT' WHERE ledger_account_id = 'asset-active'")
    await database!.execute("INSERT INTO investment_accounts (ledger_account_id, book_id) VALUES ('asset-active', 'book-1')")
    await database!.execute("INSERT INTO investment_instruments (id, book_id, name, normalized_name, type, currency, status, version) VALUES ('instrument-1', 'book-1', 'CDB', 'cdb', 'CDB', 'BRL', 'ACTIVE', 0)")
  }
  async function insertPosition(id = 'position-1', mode = 'UNITS', quantity: string | null = '10'): Promise<void> {
    await database!.execute("INSERT INTO investment_positions (id, book_id, investment_account_id, instrument_id, normalized_label, quantity_mode, quantity, book_cost_minor, currency, opened_on, closed_on, status, allocation_revision, allocation_effective_on, version) VALUES (?, 'book-1', 'asset-active', 'instrument-1', '', ?, ?, 1000, 'BRL', '2026-01-01', NULL, 'OPEN', 1, '2026-01-01', 0)", [id, mode, quantity])
  }
  it('creates strict positions and terms with no account-instrument uniqueness', async () => {
    await createV6PositionDatabase(); await migrate(); await insertPosition('position-1'); await insertPosition('position-2')
    await expect(database!.query("SELECT id FROM investment_positions ORDER BY id")).resolves.toEqual([{ id: 'position-1' }, { id: 'position-2' }])
  })
  it('requires quantity only for UNITS positions', async () => {
    await createV6PositionDatabase(); await migrate()
    await expect(insertPosition('bad-units', 'UNITS', null)).rejects.toThrow()
    await expect(insertPosition('bad-amount', 'AMOUNT', '1')).rejects.toThrow()
  })
  it('requires a closed date exactly for CLOSED positions', async () => {
    await createV6PositionDatabase(); await migrate()
    await expect(database!.execute("INSERT INTO investment_positions (id, book_id, investment_account_id, instrument_id, normalized_label, quantity_mode, quantity, book_cost_minor, currency, opened_on, closed_on, status, allocation_revision, allocation_effective_on, version) VALUES ('bad', 'book-1', 'asset-active', 'instrument-1', '', 'UNITS', '1', 1, 'BRL', '2026-01-01', NULL, 'CLOSED', 1, '2026-01-01', 0)")).rejects.toThrow()
  })
  it('requires initial positive allocation revision', async () => {
    await createV6PositionDatabase(); await migrate()
    await expect(database!.execute("INSERT INTO investment_positions (id, book_id, investment_account_id, instrument_id, normalized_label, quantity_mode, quantity, book_cost_minor, currency, opened_on, closed_on, status, allocation_revision, allocation_effective_on, version) VALUES ('bad', 'book-1', 'asset-active', 'instrument-1', '', 'UNITS', '1', 1, 'BRL', '2026-01-01', NULL, 'OPEN', 0, '2026-01-01', 0)")).rejects.toThrow()
  })
  it('rejects a position parent from another book', async () => { await createV6PositionDatabase(); await migrate(); await expect(database!.execute("INSERT INTO investment_positions (id, book_id, investment_account_id, instrument_id, normalized_label, quantity_mode, quantity, book_cost_minor, currency, opened_on, closed_on, status, allocation_revision, allocation_effective_on, version) VALUES ('bad', 'book-1', 'asset-active', 'missing', '', 'UNITS', '1', 1, 'BRL', '2026-01-01', NULL, 'OPEN', 1, '2026-01-01', 0)")).rejects.toThrow() })
  it('accepts complete prefixed, indexed and hybrid terms', async () => { await createV6PositionDatabase(); await migrate(); await insertPosition('position-1'); await insertPosition('position-2'); await insertPosition('position-3'); await database!.execute("INSERT INTO investment_fixed_income_terms (position_id, book_id, rate_kind, annual_rate) VALUES ('position-1', 'book-1', 'PREFIXED', '10')"); await database!.execute("INSERT INTO investment_fixed_income_terms (position_id, book_id, rate_kind, index_name, index_percentage) VALUES ('position-2', 'book-1', 'INDEXED', 'CDI', '100')"); await database!.execute("INSERT INTO investment_fixed_income_terms (position_id, book_id, rate_kind, index_name, index_percentage, annual_spread_rate) VALUES ('position-3', 'book-1', 'HYBRID', 'IPCA', '100', '5')"); await expect(database!.query("SELECT position_id, rate_kind FROM investment_fixed_income_terms ORDER BY position_id")).resolves.toEqual([{ position_id: 'position-1', rate_kind: 'PREFIXED' }, { position_id: 'position-2', rate_kind: 'INDEXED' }, { position_id: 'position-3', rate_kind: 'HYBRID' }]) })
  it('rejects incomplete fixed-income variants and invalid known date order', async () => { await createV6PositionDatabase(); await migrate(); await insertPosition(); await expect(database!.execute("INSERT INTO investment_fixed_income_terms (position_id, book_id, rate_kind, annual_rate) VALUES ('position-1', 'book-1', 'PREFIXED', NULL)")).rejects.toThrow(); await expect(database!.execute("INSERT INTO investment_fixed_income_terms (position_id, book_id, issue_date, maturity_date) VALUES ('position-1', 'book-1', '2026-02-01', '2026-01-01')")).rejects.toThrow() })
  it('rolls back version seven when SQL fails', async () => { await createV6PositionDatabase(); const migration = sqliteMigrations.find(({ version }) => version === 7)!; await expect(new SqliteMigrationRunner(database!, [...V6_MIGRATIONS, { ...migration, sql: migration.sql + '\nINVALID SQL;' }]).migrate()).rejects.toThrow(); await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }]) })

  async function createV7OperationDatabase(): Promise<void> { await createV6PositionDatabase(); await new SqliteMigrationRunner(database!, sqliteMigrations.filter(({ version }) => version <= 7)).migrate(); await insertPosition() }
  async function insertOperation(id = 'operation-1', sequence = 1, role = 'BUSINESS', reversalOf: string | null = null, cashMode = 'NONE', settlement: string | null = null): Promise<void> { await database!.execute("INSERT INTO investment_operations (id, book_id, position_id, type, role, occurred_on, recorded_at, sequence, description, currency, book_cost_delta_minor, gross_amount_minor, fees_minor, taxes_minor, net_cash_flow_minor, cash_mode, settlement_account_id, before_kind, version, reversal_of_id) VALUES (?, 'book-1', 'position-1', 'PURCHASE', ?, '2026-01-01', '2026-01-01T00:00:00.000Z', ?, 'test', 'BRL', 100, 100, 0, 0, -100, ?, ?, 'EXISTING', 0, ?)", [id, role, sequence, cashMode, settlement, reversalOf]) }
  it('creates strict operation and sequence tables', async () => { await createV7OperationDatabase(); await migrate(); await expect(database!.query("SELECT name FROM sqlite_schema WHERE name IN ('investment_operations', 'investment_sequences') ORDER BY name")).resolves.toEqual([{ name: 'investment_operations' }, { name: 'investment_sequences' }]) })
  it('persists operation scalar effects and integer sequence', async () => { await createV7OperationDatabase(); await migrate(); await insertOperation(); await expect(database!.query("SELECT sequence, book_cost_delta_minor, net_cash_flow_minor FROM investment_operations")).resolves.toEqual([{ sequence: 1, book_cost_delta_minor: 100, net_cash_flow_minor: -100 }]) })
  it('rejects duplicate sequence within a book', async () => { await createV7OperationDatabase(); await migrate(); await insertOperation(); await expect(insertOperation('operation-2')).rejects.toThrow() })
  it('rejects zero sequence and invalid operation role', async () => { await createV7OperationDatabase(); await migrate(); await expect(insertOperation('zero', 0)).rejects.toThrow(); await expect(insertOperation('role', 2, 'OTHER')).rejects.toThrow() })
  it('requires settlement exactly for external cash', async () => { await createV7OperationDatabase(); await migrate(); await expect(insertOperation('external', 2, 'BUSINESS', null, 'EXTERNAL_ACCOUNT')).rejects.toThrow(); await expect(insertOperation('internal', 3, 'BUSINESS', null, 'INTERNAL_CASH', 'asset-active')).rejects.toThrow() })
  it('requires reversal lineage for reversal facts', async () => { await createV7OperationDatabase(); await migrate(); await expect(insertOperation('reversal', 2, 'REVERSAL')).rejects.toThrow() })
  it('rejects self lineage', async () => { await createV7OperationDatabase(); await migrate(); await expect(database!.execute("INSERT INTO investment_operations (id, book_id, position_id, type, role, occurred_on, recorded_at, sequence, description, currency, book_cost_delta_minor, gross_amount_minor, fees_minor, taxes_minor, net_cash_flow_minor, cash_mode, before_kind, version, reversal_of_id) VALUES ('self', 'book-1', 'position-1', 'PURCHASE', 'BUSINESS', '2026-01-01', '2026-01-01T00:00:00.000Z', 1, 'test', 'BRL', 1, 1, 0, 0, -1, 'NONE', 'EXISTING', 0, 'self')")).rejects.toThrow() })
  it('rejects effect updates while allowing no effect to be silently changed', async () => { await createV7OperationDatabase(); await migrate(); await insertOperation(); await expect(database!.execute("UPDATE investment_operations SET net_cash_flow_minor = 0 WHERE id = 'operation-1'")).rejects.toThrow('immutable') })
  it('keeps the effective-operation partial index', async () => { await createV7OperationDatabase(); await migrate(); await expect(database!.query("SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'ix_investment_operations_effective'")).resolves.toEqual([{ name: 'ix_investment_operations_effective' }]) })
  it('rolls back version eight when its SQL fails', async () => { await createV7OperationDatabase(); const migration = sqliteMigrations.find(({ version }) => version === 8)!; await expect(new SqliteMigrationRunner(database!, [...sqliteMigrations.filter(({ version }) => version <= 7), { ...migration, sql: migration.sql + '\nINVALID SQL;' }]).migrate()).rejects.toThrow(); await expect(database!.query("SELECT version FROM schema_migrations ORDER BY version")).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }]) })
  async function valuationDatabase(): Promise<void> { await createV7OperationDatabase(); await migrate() }
  async function valuation(id = 'valuation-1', sequence = 1, valuedAt = '2026-01-01T10:00:00.000Z'): Promise<void> { await database!.execute("INSERT INTO investment_valuations (id, book_id, position_id, allocation_revision, valued_at, valued_on, recorded_at, record_sequence, source, currency, gross_value_minor) VALUES (?, 'book-1', 'position-1', 1, ?, '2026-01-01', '2026-01-01T11:00:00.000Z', ?, 'MANUAL', 'BRL', 100)", [id, valuedAt, sequence]) }
  it('creates strict valuation storage and current index', async () => { await valuationDatabase(); await expect(database!.query("SELECT name FROM sqlite_schema WHERE name = 'ix_investment_valuations_current'")).resolves.toEqual([{ name: 'ix_investment_valuations_current' }]) })
  it('persists scalar observation values', async () => { await valuationDatabase(); await valuation(); await expect(database!.query("SELECT gross_value_minor, source FROM investment_valuations")).resolves.toEqual([{ gross_value_minor: 100, source: 'MANUAL' }]) })
  it('allows two observations at the same instant', async () => { await valuationDatabase(); await valuation('one', 1); await valuation('two', 2); await expect(database!.query("SELECT id FROM investment_valuations ORDER BY record_sequence")).resolves.toEqual([{ id: 'one' }, { id: 'two' }]) })
  it('orders ties by persisted record sequence', async () => { await valuationDatabase(); await valuation('one', 1); await valuation('two', 2); await expect(database!.query("SELECT id FROM investment_valuations ORDER BY valued_at DESC, recorded_at DESC, record_sequence DESC LIMIT 1")).resolves.toEqual([{ id: 'two' }]) })
  it('rejects duplicate record sequence per book', async () => { await valuationDatabase(); await valuation(); await expect(valuation('two')).rejects.toThrow() })
  it('rejects invalid revision and source', async () => { await valuationDatabase(); await expect(database!.execute("INSERT INTO investment_valuations (id, book_id, position_id, allocation_revision, valued_at, valued_on, recorded_at, record_sequence, source, currency, gross_value_minor) VALUES ('bad', 'book-1', 'position-1', 0, '2026-01-01T00:00:00.000Z', '2026-01-01', '2026-01-01T00:00:00.000Z', 1, 'AUTO', 'BRL', 1)")).rejects.toThrow() })
  it('rejects valuation parent from another book', async () => { await valuationDatabase(); await expect(database!.execute("INSERT INTO investment_valuations (id, book_id, position_id, allocation_revision, valued_at, valued_on, recorded_at, record_sequence, source, currency, gross_value_minor) VALUES ('bad', 'book-1', 'missing', 1, '2026-01-01T00:00:00.000Z', '2026-01-01', '2026-01-01T00:00:00.000Z', 1, 'MANUAL', 'BRL', 1)")).rejects.toThrow() })
  it('rejects updates and deletes', async () => { await valuationDatabase(); await valuation(); await expect(database!.execute("UPDATE investment_valuations SET gross_value_minor = 0")).rejects.toThrow('immutable'); await expect(database!.execute("DELETE FROM investment_valuations")).rejects.toThrow('immutable') })
})
