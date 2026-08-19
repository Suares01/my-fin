import type {
  BookCatalogQueries,
  FinancialBookSummary,
} from "@workspace/application"
import type { SqliteReader } from "../../database/index.js"
import { readString } from "../sqlite-query-values.js"

const LIST_FINANCIAL_BOOKS_SQL =
  "SELECT id, name, base_currency, timezone " +
  "FROM financial_books " +
  "ORDER BY name COLLATE BINARY ASC, id ASC"

type FinancialBookRow = {
  readonly id: unknown
  readonly name: unknown
  readonly base_currency: unknown
  readonly timezone: unknown
}

export class SqliteBookCatalogQueries implements BookCatalogQueries {
  public constructor(private readonly reader: SqliteReader) {}

  public async listFinancialBooks(): Promise<readonly FinancialBookSummary[]> {
    const rows = await this.reader.query<FinancialBookRow>(
      LIST_FINANCIAL_BOOKS_SQL
    )

    return rows.map(toFinancialBookSummary)
  }

  public async getFinancialBook(input: {
    readonly bookId: import("@workspace/domain").BookId
  }): Promise<FinancialBookSummary | null> {
    const rows = await this.reader.query<FinancialBookRow>(
      "SELECT id, name, base_currency, timezone FROM financial_books WHERE id = ?",
      [input.bookId]
    )
    const row = rows[0]
    return row === undefined ? null : toFinancialBookSummary(row)
  }
}

function toFinancialBookSummary(row: FinancialBookRow): FinancialBookSummary {
  return {
    id: readString(row.id, "id"),
    name: readString(row.name, "name"),
    baseCurrency: readString(row.base_currency, "base_currency"),
    timezone: readString(row.timezone, "timezone"),
  }
}
