import type {
  CategorySummary,
  CategoryCatalogQueries,
  ExpenseCategorySummary,
  IncomeCategorySummary,
} from "@workspace/application"
import type { BookId } from "@workspace/domain"
import type { SqliteReader } from "../../database/index.js"
import {
  readAccountKind,
  readAccountStatus,
  readInteger,
  readString,
} from "../sqlite-query-values.js"

const LIST_EXPENSE_CATEGORIES_SQL =
  "SELECT id, name, kind " +
  "FROM ledger_accounts " +
  "WHERE book_id = ? AND kind = 'EXPENSE' AND status = 'ACTIVE' " +
  "AND system_purpose IS NULL " +
  "ORDER BY normalized_name COLLATE BINARY ASC, id ASC"

const LIST_INCOME_CATEGORIES_SQL =
  "SELECT id, name, kind " +
  "FROM ledger_accounts " +
  "WHERE book_id = ? AND kind = 'INCOME' AND status = 'ACTIVE' " +
  "AND system_purpose IS NULL " +
  "ORDER BY normalized_name COLLATE BINARY ASC, id ASC"

const LIST_CATEGORIES_SQL =
  "SELECT id, name, kind, status, version " +
  "FROM ledger_accounts " +
  "WHERE book_id = ? AND kind IN ('INCOME', 'EXPENSE') " +
  "AND system_purpose IS NULL "

type ExpenseCategoryRow = {
  readonly id: unknown
  readonly name: unknown
  readonly kind: unknown
}

type IncomeCategoryRow = ExpenseCategoryRow

type CategoryRow = {
  readonly id: unknown
  readonly name: unknown
  readonly kind: unknown
  readonly status: unknown
  readonly version: unknown
}

export class SqliteCategoryCatalogQueries implements CategoryCatalogQueries {
  public constructor(private readonly reader: SqliteReader) {}

  public async listExpenseCategories(input: {
    readonly bookId: BookId
  }): Promise<readonly ExpenseCategorySummary[]> {
    const rows = await this.reader.query<ExpenseCategoryRow>(
      LIST_EXPENSE_CATEGORIES_SQL,
      [input.bookId]
    )

    return rows.flatMap((row) => {
      if (
        row.kind !== "EXPENSE" ||
        typeof row.id !== "string" ||
        typeof row.name !== "string"
      ) {
        return []
      }

      return [{ id: row.id, name: row.name, kind: "EXPENSE" }]
    })
  }

  public async listIncomeCategories(input: {
    readonly bookId: BookId
  }): Promise<readonly IncomeCategorySummary[]> {
    const rows = await this.reader.query<IncomeCategoryRow>(
      LIST_INCOME_CATEGORIES_SQL,
      [input.bookId]
    )

    return rows.flatMap((row) => {
      if (
        row.kind !== "INCOME" ||
        typeof row.id !== "string" ||
        typeof row.name !== "string"
      ) {
        return []
      }

      return [{ id: row.id, name: row.name, kind: "INCOME" }]
    })
  }

  public async listCategories(input: {
    readonly bookId: BookId
    readonly includeArchived: boolean
  }): Promise<readonly CategorySummary[]> {
    const statusClause = input.includeArchived ? "" : "AND status = 'ACTIVE' "
    const rows = await this.reader.query<CategoryRow>(
      `${LIST_CATEGORIES_SQL}${statusClause}ORDER BY kind COLLATE BINARY ASC, ` +
        "normalized_name COLLATE BINARY ASC, id ASC",
      [input.bookId]
    )

    return rows.map((row) => ({
      id: readString(row.id, "category_id"),
      name: readString(row.name, "category_name"),
      kind: readCategoryKind(row.kind),
      status: readAccountStatus(row.status),
      version: readInteger(row.version, "category_version"),
    }))
  }

  public async getCategoryDetail(input: {
    readonly bookId: BookId
    readonly categoryId: import("@workspace/domain").LedgerAccountId
  }): Promise<CategorySummary | null> {
    const rows = await this.reader.query<CategoryRow>(
      "SELECT id, name, kind, status, version FROM ledger_accounts " +
        "WHERE book_id = ? AND id = ? AND kind IN ('INCOME', 'EXPENSE') " +
        "AND system_purpose IS NULL",
      [input.bookId, input.categoryId]
    )
    const row = rows[0]
    return row === undefined
      ? null
      : {
          id: readString(row.id, "category_id"),
          name: readString(row.name, "category_name"),
          kind: readCategoryKind(row.kind),
          status: readAccountStatus(row.status),
          version: readInteger(row.version, "category_version"),
        }
  }
}

function readCategoryKind(value: unknown): "INCOME" | "EXPENSE" {
  const kind = readAccountKind(value)
  if (kind !== "INCOME" && kind !== "EXPENSE") {
    throw new TypeError("Invalid category kind")
  }
  return kind
}
