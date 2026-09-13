import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { configureSqliteConnection } from "../../src/database/configure-sqlite-connection.js"
import {
  sqliteMigrations,
  SqliteMigrationRunner,
} from "../../src/migrations/index.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

const BOOK_COLUMNS = ["id", "name", "base_currency", "timezone", "version"]
const ACCOUNT_COLUMNS = [
  "id",
  "book_id",
  "name",
  "normalized_name",
  "kind",
  "status",
  "system_purpose",
  "version",
  "icon_key",
  "color_hex",
]
const SEQUENCE_COLUMNS = ["book_id", "last_sequence"]
const ENTRY_COLUMNS = [
  "id",
  "book_id",
  "occurred_on",
  "recorded_at",
  "sequence",
  "description",
  "currency",
  "origin",
  "reversal_of_id",
  "reversed_by_id",
  "version",
  "replacement_of_id",
  "replaced_by_id",
  "search_text",
  "search_version",
]
const POSTING_COLUMNS = [
  "id",
  "book_id",
  "journal_entry_id",
  "account_id",
  "position",
  "amount_minor",
  "currency",
]

type TableInfoRow = { readonly name: string }

describe("initial financial ledger migration", () => {
  let database: BetterSqliteDatabase

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await configureSqliteConnection(database, { inMemory: true })
    await new SqliteMigrationRunner(database, sqliteMigrations).migrate()
  })

  afterEach(async () => {
    await database.close()
  })

  async function columns(table: string): Promise<string[]> {
    const rows = await database.query<TableInfoRow>(
      `PRAGMA table_info(${table})`
    )
    return rows.map((row) => row.name)
  }

  async function insertBook(id = "book-1"): Promise<void> {
    await database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
        "VALUES (?, ?, ?, ?, ?)",
      [id, "Main book", "BRL", "America/Sao_Paulo", 0]
    )
  }

  async function insertAccount(
    id = "account-1",
    bookId = "book-1",
    normalizedName = "cash",
    systemPurpose: string | null = null
  ): Promise<void> {
    await database.execute(
      "INSERT INTO ledger_accounts " +
        "(id, book_id, name, normalized_name, kind, status, system_purpose, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, bookId, "Cash", normalizedName, "ASSET", "ACTIVE", systemPurpose, 0]
    )
  }

  async function insertEntry(
    id = "entry-1",
    bookId = "book-1",
    sequence = "1",
    reversalOfId: string | null = null,
    reversedById: string | null = null
  ): Promise<void> {
    await database.execute(
      "INSERT INTO journal_entries " +
        "(id, book_id, occurred_on, recorded_at, sequence, description, " +
        "currency, origin, reversal_of_id, reversed_by_id, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        bookId,
        "2026-08-04",
        "2026-08-04T12:00:00.000Z",
        sequence,
        "Entry",
        "BRL",
        "MANUAL",
        reversalOfId,
        reversedById,
        0,
      ]
    )
  }

  it("creates every approved table with exactly the snapshot columns", async () => {
    await expect(columns("schema_migrations")).resolves.toEqual([
      "version",
      "name",
      "checksum",
      "applied_at",
    ])
    await expect(columns("financial_books")).resolves.toEqual(BOOK_COLUMNS)
    await expect(columns("ledger_accounts")).resolves.toEqual(ACCOUNT_COLUMNS)
    await expect(columns("journal_sequences")).resolves.toEqual(
      SEQUENCE_COLUMNS
    )
    await expect(columns("journal_entries")).resolves.toEqual(ENTRY_COLUMNS)
    await expect(columns("postings")).resolves.toEqual(POSTING_COLUMNS)
  })

  it("creates only the approved control and ledger tables", async () => {
    const rows = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name"
    )

    expect(rows.map((row) => row.name)).toEqual([
      "financial_accounts",
      "financial_books",
      "investment_accounts",
      "investment_instrument_identifiers",
      "investment_instruments",
      "journal_entries",
      "journal_sequences",
      "ledger_accounts",
      "postings",
      "schema_migrations",
    ])
  })

  it("leaves domain and application invariants outside the schema", async () => {
    const triggers = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'trigger'"
    )
    const tableDefinitions = await database.query<{ sql: string }>(
      "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name IN " +
        "('financial_books', 'ledger_accounts', 'journal_sequences', " +
        "'journal_entries', 'postings')"
    )

    expect(triggers.map(({ name }) => name).sort()).toEqual([
      "trg_category_visual_metadata_insert",
      "trg_category_visual_metadata_update",
      "trg_financial_accounts_insert",
      "trg_financial_accounts_update",
      "trg_investment_accounts_insert",
      "trg_investment_accounts_update",
      "trg_journal_entries_replaced_by_same_book_insert",
      "trg_journal_entries_replaced_by_same_book_update",
      "trg_journal_entries_replacement_of_same_book_insert",
      "trg_journal_entries_replacement_of_same_book_update",
    ])
    expect(
      tableDefinitions.every(
        ({ sql }) =>
          !/balanced|minimum[_ ]posting|minimum[_ ]account/i.test(sql)
      )
    ).toBe(true)
  })

  it("makes the control and ledger tables STRICT", async () => {
    const rows = await database.query<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_schema " +
        "WHERE type = 'table' AND name IN " +
        "('schema_migrations', 'financial_books', 'ledger_accounts', " +
        "'journal_sequences', 'journal_entries', 'postings') ORDER BY name"
    )

    expect(rows).toHaveLength(6)
    expect(rows.every((row) => row.sql.includes("STRICT"))).toBe(true)
  })

  it("rejects a posting that relates an account from another book", async () => {
    await insertBook()
    await insertBook("book-2")
    await insertAccount("account-1", "book-1")
    await insertAccount("account-2", "book-2")
    await insertEntry("entry-2", "book-2")

    await expect(
      database.execute(
        "INSERT INTO postings " +
          "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["posting-1", "book-2", "entry-2", "account-1", 0, 100, "BRL"]
      )
    ).rejects.toThrow()
  })

  it("rejects a posting that relates an entry from another book", async () => {
    await insertBook()
    await insertBook("book-2")
    await insertAccount("account-1", "book-1")
    await insertAccount("account-2", "book-2")
    await insertEntry("entry-1", "book-1")

    await expect(
      database.execute(
        "INSERT INTO postings " +
          "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["posting-1", "book-2", "entry-1", "account-2", 0, 100, "BRL"]
      )
    ).rejects.toThrow()
  })

  it("rejects a reversal link that crosses books", async () => {
    await insertBook()
    await insertBook("book-2")
    await insertEntry("entry-1", "book-1")

    await expect(
      insertEntry("entry-2", "book-2", "1", "entry-1")
    ).rejects.toThrow()
  })

  it("restricts domain enums to their approved values", async () => {
    await insertBook()

    await expect(
      database.execute(
        "INSERT INTO ledger_accounts " +
          "(id, book_id, name, normalized_name, kind, status, version) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "account-invalid-kind",
          "book-1",
          "Cash",
          "cash-invalid",
          "BANK",
          "ACTIVE",
          0,
        ]
      )
    ).rejects.toThrow()
    await expect(
      database.execute(
        "INSERT INTO ledger_accounts " +
          "(id, book_id, name, normalized_name, kind, status, version) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "account-invalid-status",
          "book-1",
          "Cash",
          "cash-status",
          "ASSET",
          "DELETED",
          0,
        ]
      )
    ).rejects.toThrow()
    await expect(
      insertEntry("entry-invalid-origin", "book-1", "1")
    ).resolves.toBeUndefined()
    await expect(
      database.execute("UPDATE journal_entries SET origin = ? WHERE id = ?", [
        "IMPORT",
        "entry-invalid-origin",
      ])
    ).rejects.toThrow()
  })

  it("restricts currencies, versions, positions and amounts", async () => {
    await expect(
      database.execute(
        "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
          "VALUES (?, ?, ?, ?, ?)",
        ["bad-currency", "Book", "brl", "UTC", 0]
      )
    ).rejects.toThrow()
    await expect(
      database.execute(
        "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
          "VALUES (?, ?, ?, ?, ?)",
        ["bad-version", "Book", "BRL", "UTC", -1]
      )
    ).rejects.toThrow()

    await insertBook()
    await insertAccount()
    await insertEntry()
    await expect(
      database.execute(
        "INSERT INTO postings " +
          "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "posting-bad-position",
          "book-1",
          "entry-1",
          "account-1",
          -1,
          100,
          "BRL",
        ]
      )
    ).rejects.toThrow()
    await expect(
      database.execute(
        "INSERT INTO postings " +
          "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["posting-zero", "book-1", "entry-1", "account-1", 0, 0, "BRL"]
      )
    ).rejects.toThrow()
    await expect(
      database.execute(
        "INSERT INTO postings " +
          "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "posting-bad-currency",
          "book-1",
          "entry-1",
          "account-1",
          0,
          100,
          "brl",
        ]
      )
    ).rejects.toThrow()
  })

  it("bounds journal sequences and keeps one sequence row per book", async () => {
    await insertBook()
    await expect(
      database.execute(
        "INSERT INTO journal_sequences (book_id, last_sequence) VALUES (?, ?)",
        ["book-1", -1]
      )
    ).rejects.toThrow()
    await database.executeBatch(
      "INSERT INTO journal_sequences (book_id, last_sequence) " +
        "VALUES ('book-1', 9223372036854775807);"
    )
    await expect(
      database.execute(
        "INSERT INTO journal_sequences (book_id, last_sequence) VALUES (?, ?)",
        ["book-1", 1]
      )
    ).rejects.toThrow()
  })

  it("enforces account IDs, normalized names and system purposes", async () => {
    await insertBook()
    await insertAccount("account-1", "book-1", "cash", "OPENING_BALANCE")
    await expect(
      insertAccount("account-1", "book-1", "other-cash")
    ).rejects.toThrow()
    await expect(insertAccount("account-2", "book-1", "cash")).rejects.toThrow()
    await expect(
      insertAccount("account-3", "book-1", "other", "OPENING_BALANCE")
    ).rejects.toThrow()
  })

  it("enforces entry sequence and reversal-link uniqueness per book", async () => {
    await insertBook()
    await insertEntry("entry-1", "book-1", "1")
    await expect(
      insertEntry("entry-duplicate-sequence", "book-1", "1")
    ).rejects.toThrow()
    await insertEntry("entry-2", "book-1", "2", "entry-1")
    await expect(
      insertEntry("entry-3", "book-1", "3", "entry-1")
    ).rejects.toThrow()
    await insertEntry("entry-4", "book-1", "4", null, "entry-1")
    await expect(
      insertEntry("entry-5", "book-1", "5", null, "entry-1")
    ).rejects.toThrow()
  })

  it("enforces one posting position per journal entry", async () => {
    await insertBook()
    await insertAccount()
    await insertEntry()
    await database.execute(
      "INSERT INTO postings " +
        "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["posting-1", "book-1", "entry-1", "account-1", 0, 100, "BRL"]
    )

    await expect(
      database.execute(
        "INSERT INTO postings " +
          "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["posting-2", "book-1", "entry-1", "account-1", 0, -100, "BRL"]
      )
    ).rejects.toThrow()
  })

  it("creates the indexes from the approved index plan", async () => {
    const rows = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'index' " +
        "AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )

    expect(rows.map((row) => row.name)).toEqual([
      "ix_financial_accounts_book_type",
      "ix_investment_accounts_book_settlement",
      "ix_investment_instrument_identifiers_book_instrument",
      "ix_investment_instruments_book_status_type_name",
      "ix_journal_entries_book_date_sequence",
      "ix_journal_entries_book_date_sequence_numeric",
      "ix_journal_entries_book_search",
      "ix_journal_entries_reversal_of",
      "ix_journal_entries_reversed_by",
      "ix_ledger_accounts_book",
      "ix_postings_account_entry",
      "ix_postings_book_account_entry_position",
      "ix_postings_entry",
      "ux_journal_entries_replaced_by",
      "ux_journal_entries_replacement_of",
      "ux_ledger_account_name",
      "ux_system_account_purpose",
    ])
  })

  it("defines numeric sequence ordering and posting position indexes", async () => {
    const rows = await database.query<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_schema WHERE type = 'index' " +
        "AND name IN (?, ?) ORDER BY name",
      [
        "ix_journal_entries_book_date_sequence_numeric",
        "ix_postings_book_account_entry_position",
      ]
    )

    expect(rows).toEqual([
      {
        name: "ix_journal_entries_book_date_sequence_numeric",
        sql: expect.stringContaining("length(sequence) DESC"),
      },
      {
        name: "ix_postings_book_account_entry_position",
        sql: expect.stringContaining("account_id, journal_entry_id, position"),
      },
    ])
  })

  it("passes SQLite integrity and foreign-key checks after migration", async () => {
    await expect(
      database.query<{ integrity_check: string }>("PRAGMA integrity_check")
    ).resolves.toEqual([{ integrity_check: "ok" }])
    await expect(database.query("PRAGMA foreign_key_check")).resolves.toEqual(
      []
    )
  })
})
