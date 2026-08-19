import { initializeSqliteDatabase } from "../../src/database/index.js"
import {
  SqliteBookCatalogQueries,
  SqliteCategoryCatalogQueries,
} from "../../src/index.js"
import { bookIdFromString, ledgerAccountIdFromString } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

describe("SQLite catalog queries", () => {
  let database: BetterSqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  async function initializedDatabase() {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    return database
  }

  async function insertBook(
    currentDatabase: BetterSqliteDatabase,
    id: string,
    name: string
  ) {
    await currentDatabase.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) " +
        "VALUES (?, ?, 'BRL', 'America/Sao_Paulo', 0)",
      [id, name]
    )
  }

  async function insertCategory(
    currentDatabase: BetterSqliteDatabase,
    values: {
      id: string
      bookId: string
      name: string
      normalizedName: string
      kind?: string
      status?: string
      systemPurpose?: string | null
    }
  ) {
    await currentDatabase.execute(
      "INSERT INTO ledger_accounts " +
        "(id, book_id, name, normalized_name, kind, status, system_purpose, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
      [
        values.id,
        values.bookId,
        values.name,
        values.normalizedName,
        values.kind ?? "EXPENSE",
        values.status ?? "ACTIVE",
        values.systemPurpose ?? null,
      ]
    )
  }

  it("returns an empty book catalog from the real migrated schema", async () => {
    const currentDatabase = await initializedDatabase()

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).listFinancialBooks()
    ).resolves.toEqual([])
  })

  it("returns exact book DTOs in deterministic binary order", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-z", "Casa")
    await insertBook(currentDatabase, "book-a", "Casa")
    await insertBook(currentDatabase, "book-b", "Água")

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).listFinancialBooks()
    ).resolves.toEqual([
      {
        id: "book-a",
        name: "Casa",
        baseCurrency: "BRL",
        timezone: "America/Sao_Paulo",
      },
      {
        id: "book-z",
        name: "Casa",
        baseCurrency: "BRL",
        timezone: "America/Sao_Paulo",
      },
      {
        id: "book-b",
        name: "Água",
        baseCurrency: "BRL",
        timezone: "America/Sao_Paulo",
      },
    ])
  })

  it("uses one unparameterized statement for books", async () => {
    const currentDatabase = await initializedDatabase()
    const query = vi.spyOn(currentDatabase, "query")

    await new SqliteBookCatalogQueries(currentDatabase).listFinancialBooks()

    expect(query).toHaveBeenCalledOnce()
    expect(query).toHaveBeenCalledWith(
      "SELECT id, name, base_currency, timezone FROM financial_books ORDER BY name COLLATE BINARY ASC, id ASC"
    )
  })

  it("returns only active user expense categories for the requested book", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertBook(currentDatabase, "book-2", "Trabalho")
    await insertCategory(currentDatabase, {
      id: "category-user",
      bookId: "book-1",
      name: "Mercado",
      normalizedName: "mercado",
    })
    await insertCategory(currentDatabase, {
      id: "category-system",
      bookId: "book-1",
      name: "Não categorizado",
      normalizedName: "nao categorizado",
      systemPurpose: "UNCATEGORIZED_EXPENSE",
    })
    await insertCategory(currentDatabase, {
      id: "category-archived",
      bookId: "book-1",
      name: "Antiga",
      normalizedName: "antiga",
      status: "ARCHIVED",
    })
    await insertCategory(currentDatabase, {
      id: "category-income",
      bookId: "book-1",
      name: "Salário",
      normalizedName: "salario",
      kind: "INCOME",
    })
    await insertCategory(currentDatabase, {
      id: "category-other-book",
      bookId: "book-2",
      name: "Mercado",
      normalizedName: "mercado",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listExpenseCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([
      { id: "category-user", name: "Mercado", kind: "EXPENSE" },
    ])
  })

  it("orders categories by normalized name and id", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "category-casa",
      bookId: "book-1",
      name: "Casa",
      normalizedName: "casa",
    })
    await insertCategory(currentDatabase, {
      id: "category-aluguel",
      bookId: "book-1",
      name: "Aluguel",
      normalizedName: "aluguel",
    })
    await insertCategory(currentDatabase, {
      id: "category-b",
      bookId: "book-1",
      name: "Água",
      normalizedName: "água",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listExpenseCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([
      { id: "category-aluguel", name: "Aluguel", kind: "EXPENSE" },
      { id: "category-casa", name: "Casa", kind: "EXPENSE" },
      { id: "category-b", name: "Água", kind: "EXPENSE" },
    ])
  })

  it("isolates categories by book id", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertBook(currentDatabase, "book-2", "Trabalho")
    await insertCategory(currentDatabase, {
      id: "category-1",
      bookId: "book-1",
      name: "Casa",
      normalizedName: "casa",
    })
    await insertCategory(currentDatabase, {
      id: "category-2",
      bookId: "book-2",
      name: "Casa",
      normalizedName: "casa",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listExpenseCategories({
        bookId: bookIdFromString("book-2"),
      })
    ).resolves.toEqual([{ id: "category-2", name: "Casa", kind: "EXPENSE" }])
  })

  it("uses one parametrized category statement", async () => {
    const currentDatabase = await initializedDatabase()
    const query = vi.spyOn(currentDatabase, "query")

    await new SqliteCategoryCatalogQueries(
      currentDatabase
    ).listExpenseCategories({
      bookId: bookIdFromString("book-1"),
    })

    expect(query).toHaveBeenCalledOnce()
    expect(query.mock.calls[0]).toEqual([
      "SELECT id, name, kind FROM ledger_accounts WHERE book_id = ? AND kind = 'EXPENSE' AND status = 'ACTIVE' AND system_purpose IS NULL ORDER BY normalized_name COLLATE BINARY ASC, id ASC",
      ["book-1"],
    ])
  })

  it("returns an empty category catalog for a book with no user categories", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listExpenseCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([])
  })

  it("does not leak a malformed category row as a valid item", async () => {
    const currentDatabase = await initializedDatabase()
    const query = vi
      .spyOn(currentDatabase, "query")
      .mockResolvedValueOnce([
        { id: "category-invalid", name: "Invalid", kind: "INCOME" },
      ])

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listExpenseCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([])
    expect(query).toHaveBeenCalledOnce()
  })

  it("propagates a reader failure without changing its query contract", async () => {
    const currentDatabase = await initializedDatabase()
    vi.spyOn(currentDatabase, "query").mockRejectedValueOnce(
      new Error("driver failure")
    )

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).listFinancialBooks()
    ).rejects.toThrow("driver failure")
  })

  it("returns only active user income categories for the requested book", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "income-active",
      bookId: "book-1",
      name: "Salário",
      normalizedName: "salario",
      kind: "INCOME",
    })
    await insertCategory(currentDatabase, {
      id: "income-archived",
      bookId: "book-1",
      name: "Antiga",
      normalizedName: "antiga",
      kind: "INCOME",
      status: "ARCHIVED",
    })
    await insertCategory(currentDatabase, {
      id: "income-system",
      bookId: "book-1",
      name: "Não categorizado",
      normalizedName: "nao categorizado",
      kind: "INCOME",
      systemPurpose: "UNCATEGORIZED_INCOME",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listIncomeCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([
      { id: "income-active", name: "Salário", kind: "INCOME" },
    ])
  })

  it("orders income selectors by normalized name and id", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "income-z",
      bookId: "book-1",
      name: "Casa Z",
      normalizedName: "casa z",
      kind: "INCOME",
    })
    await insertCategory(currentDatabase, {
      id: "income-a",
      bookId: "book-1",
      name: "Casa A",
      normalizedName: "casa a",
      kind: "INCOME",
    })
    await insertCategory(currentDatabase, {
      id: "income-b",
      bookId: "book-1",
      name: "Água",
      normalizedName: "água",
      kind: "INCOME",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listIncomeCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([
      { id: "income-a", name: "Casa A", kind: "INCOME" },
      { id: "income-z", name: "Casa Z", kind: "INCOME" },
      { id: "income-b", name: "Água", kind: "INCOME" },
    ])
  })

  it("returns an empty income selector without rows", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listIncomeCategories({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual([])
  })

  it("returns active and archived categories with kind and version", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "expense-1",
      bookId: "book-1",
      name: "Mercado",
      normalizedName: "mercado",
      kind: "EXPENSE",
      status: "ARCHIVED",
    })
    await insertCategory(currentDatabase, {
      id: "income-1",
      bookId: "book-1",
      name: "Salário",
      normalizedName: "salario",
      kind: "INCOME",
    })
    await currentDatabase.execute(
      "UPDATE ledger_accounts SET version = 3 WHERE id = ?",
      ["expense-1"]
    )

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listCategories({
        bookId: bookIdFromString("book-1"),
        includeArchived: true,
      })
    ).resolves.toEqual([
      {
        id: "expense-1",
        name: "Mercado",
        kind: "EXPENSE",
        status: "ARCHIVED",
        version: 3,
      },
      {
        id: "income-1",
        name: "Salário",
        kind: "INCOME",
        status: "ACTIVE",
        version: 0,
      },
    ])
  })

  it("omits archived categories when the directory is active-only", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "expense-active",
      bookId: "book-1",
      name: "Mercado",
      normalizedName: "mercado",
    })
    await insertCategory(currentDatabase, {
      id: "expense-archived",
      bookId: "book-1",
      name: "Antiga",
      normalizedName: "antiga",
      status: "ARCHIVED",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listCategories({
        bookId: bookIdFromString("book-1"),
        includeArchived: false,
      })
    ).resolves.toEqual([
      {
        id: "expense-active",
        name: "Mercado",
        kind: "EXPENSE",
        status: "ACTIVE",
        version: 0,
      },
    ])
  })

  it("orders the directory by kind, normalized name and id", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "income-1",
      bookId: "book-1",
      name: "Aluguel",
      normalizedName: "aluguel",
      kind: "INCOME",
    })
    await insertCategory(currentDatabase, {
      id: "expense-1",
      bookId: "book-1",
      name: "Zebra",
      normalizedName: "zebra",
    })
    await insertCategory(currentDatabase, {
      id: "expense-2",
      bookId: "book-1",
      name: "Casa",
      normalizedName: "casa",
    })

    const result = await new SqliteCategoryCatalogQueries(
      currentDatabase
    ).listCategories({
      bookId: bookIdFromString("book-1"),
      includeArchived: true,
    })

    expect(result.map(({ id }) => id)).toEqual([
      "expense-2",
      "expense-1",
      "income-1",
    ])
  })

  it("isolates the category directory by book id", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertBook(currentDatabase, "book-2", "Trabalho")
    await insertCategory(currentDatabase, {
      id: "category-1",
      bookId: "book-1",
      name: "Casa",
      normalizedName: "casa",
    })
    await insertCategory(currentDatabase, {
      id: "category-2",
      bookId: "book-2",
      name: "Casa",
      normalizedName: "casa",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listCategories({
        bookId: bookIdFromString("book-2"),
        includeArchived: true,
      })
    ).resolves.toEqual([
      {
        id: "category-2",
        name: "Casa",
        kind: "EXPENSE",
        status: "ACTIVE",
        version: 0,
      },
    ])
  })

  it("returns an empty directory for a book without user categories", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).listCategories({
        bookId: bookIdFromString("book-1"),
        includeArchived: true,
      })
    ).resolves.toEqual([])
  })

  it("returns exact active category detail fields", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "category-1",
      bookId: "book-1",
      name: "Mercado",
      normalizedName: "mercado",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).getCategoryDetail({
        bookId: bookIdFromString("book-1"),
        categoryId: ledgerAccountIdFromString("category-1"),
      })
    ).resolves.toEqual({
      id: "category-1",
      name: "Mercado",
      kind: "EXPENSE",
      status: "ACTIVE",
      version: 0,
    })
  })

  it("returns archived category detail without selector filtering", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "category-archived",
      bookId: "book-1",
      name: "Antiga",
      normalizedName: "antiga",
      status: "ARCHIVED",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).getCategoryDetail({
        bookId: bookIdFromString("book-1"),
        categoryId: ledgerAccountIdFromString("category-archived"),
      })
    ).resolves.toMatchObject({ id: "category-archived", status: "ARCHIVED" })
  })

  it("returns null for a missing category detail", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).getCategoryDetail({
        bookId: bookIdFromString("book-1"),
        categoryId: ledgerAccountIdFromString("missing"),
      })
    ).resolves.toBeNull()
  })

  it("returns null for a category detail from another book", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertBook(currentDatabase, "book-2", "Trabalho")
    await insertCategory(currentDatabase, {
      id: "category-1",
      bookId: "book-1",
      name: "Mercado",
      normalizedName: "mercado",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).getCategoryDetail({
        bookId: bookIdFromString("book-2"),
        categoryId: ledgerAccountIdFromString("category-1"),
      })
    ).resolves.toBeNull()
  })

  it("does not expose a system category through management detail", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")
    await insertCategory(currentDatabase, {
      id: "category-system",
      bookId: "book-1",
      name: "Não categorizado",
      normalizedName: "nao categorizado",
      systemPurpose: "UNCATEGORIZED_EXPENSE",
    })

    await expect(
      new SqliteCategoryCatalogQueries(currentDatabase).getCategoryDetail({
        bookId: bookIdFromString("book-1"),
        categoryId: ledgerAccountIdFromString("category-system"),
      })
    ).resolves.toBeNull()
  })

  it("uses one statement for the generalized category directory", async () => {
    const currentDatabase = await initializedDatabase()
    const query = vi.spyOn(currentDatabase, "query")

    await new SqliteCategoryCatalogQueries(currentDatabase).listCategories({
      bookId: bookIdFromString("book-1"),
      includeArchived: true,
    })

    expect(query).toHaveBeenCalledOnce()
    expect(query.mock.calls[0]?.[0]).toContain(
      "WHERE book_id = ? AND kind IN ('INCOME', 'EXPENSE') AND system_purpose IS NULL"
    )
  })

  it("uses one statement for book-scoped category detail", async () => {
    const currentDatabase = await initializedDatabase()
    const query = vi.spyOn(currentDatabase, "query")

    await new SqliteCategoryCatalogQueries(currentDatabase).getCategoryDetail({
      bookId: bookIdFromString("book-1"),
      categoryId: ledgerAccountIdFromString("missing"),
    })

    expect(query).toHaveBeenCalledOnce()
    expect(query.mock.calls[0]).toEqual([
      "SELECT id, name, kind, status, version FROM ledger_accounts WHERE book_id = ? AND id = ? AND kind IN ('INCOME', 'EXPENSE') AND system_purpose IS NULL",
      ["book-1", "missing"],
    ])
  })

  it("returns an exact financial book detail summary", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).getFinancialBook({
        bookId: bookIdFromString("book-1"),
      })
    ).resolves.toEqual({
      id: "book-1",
      name: "Casa",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
    })
  })

  it("preserves exact currency and IANA timezone across the detail query", async () => {
    const currentDatabase = await initializedDatabase()
    await currentDatabase.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
      ["book-us", "US book", "USD", "America/New_York", 0]
    )

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).getFinancialBook({
        bookId: bookIdFromString("book-us"),
      })
    ).resolves.toEqual({
      id: "book-us",
      name: "US book",
      baseCurrency: "USD",
      timezone: "America/New_York",
    })
  })

  it("returns null for a missing financial book detail", async () => {
    const currentDatabase = await initializedDatabase()

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).getFinancialBook({
        bookId: bookIdFromString("missing"),
      })
    ).resolves.toBeNull()
  })

  it("does not leak a book detail from another id", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    await expect(
      new SqliteBookCatalogQueries(currentDatabase).getFinancialBook({
        bookId: bookIdFromString("book-2"),
      })
    ).resolves.toBeNull()
  })

  it("uses one parametrized statement for book detail", async () => {
    const currentDatabase = await initializedDatabase()
    const query = vi.spyOn(currentDatabase, "query")

    await new SqliteBookCatalogQueries(currentDatabase).getFinancialBook({
      bookId: bookIdFromString("book-1"),
    })

    expect(query).toHaveBeenCalledOnce()
    expect(query.mock.calls[0]).toEqual([
      "SELECT id, name, base_currency, timezone FROM financial_books WHERE id = ?",
      ["book-1"],
    ])
  })

  it("keeps list and detail book DTOs structurally identical", async () => {
    const currentDatabase = await initializedDatabase()
    await insertBook(currentDatabase, "book-1", "Casa")

    const queries = new SqliteBookCatalogQueries(currentDatabase)
    const list = await queries.listFinancialBooks()
    const detail = await queries.getFinancialBook({
      bookId: bookIdFromString("book-1"),
    })

    expect(detail).toEqual(list[0])
    expect(Object.keys(detail ?? {}).sort()).toEqual([
      "baseCurrency",
      "id",
      "name",
      "timezone",
    ])
  })
})
