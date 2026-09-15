import type {
  InvestmentInstrumentQueries,
  InvestmentInstrumentView,
} from "@workspace/application"
import type { SqliteDatabase } from "../../database/index.js"

type Row = {
  id: string
  name: string
  type: string
  currency: string
  issuer_name: string | null
  status: "ACTIVE" | "ARCHIVED"
  scheme: string | null
  value: string | null
  market: string | null
}

/** Reads the book-scoped instrument catalog for maintenance and active selectors. */
export class SqliteInvestmentInstrumentQueries implements InvestmentInstrumentQueries {
  public constructor(private readonly database: SqliteDatabase) {}
  public async listInvestmentInstruments(input: {
    readonly bookId: string
    readonly status?: "ACTIVE" | "ARCHIVED"
  }): Promise<readonly InvestmentInstrumentView[]> {
    return this.read(input.bookId, input.status)
  }
  public async getInvestmentInstrumentDetail(input: {
    readonly bookId: string
    readonly instrumentId: string
  }): Promise<InvestmentInstrumentView | null> {
    return (
      (await this.read(input.bookId, undefined, input.instrumentId))[0] ?? null
    )
  }
  private async read(
    bookId: string,
    status?: "ACTIVE" | "ARCHIVED",
    instrumentId?: string
  ): Promise<readonly InvestmentInstrumentView[]> {
    return this.database.readTransaction(async (reader) => {
      const rows = await reader.query<Row>(
        "SELECT i.id,i.name,i.type,i.currency,i.issuer_name,i.status,x.scheme,x.value,x.market FROM investment_instruments i LEFT JOIN investment_instrument_identifiers x ON x.book_id=i.book_id AND x.instrument_id=i.id WHERE i.book_id=?" +
          (status === undefined ? "" : " AND i.status=?") +
          (instrumentId === undefined ? "" : " AND i.id=?") +
          " ORDER BY i.normalized_name ASC,i.id ASC,x.rowid ASC",
        instrumentId === undefined
          ? status === undefined
            ? [bookId]
            : [bookId, status]
          : [bookId, instrumentId]
      )
      const values = new Map<string, InvestmentInstrumentView>()
      for (const row of rows) {
        const prior = values.get(row.id)
        const identifier =
          row.scheme === null || row.value === null
            ? []
            : [
                {
                  scheme: row.scheme,
                  value: row.value,
                  ...(row.market === "" || row.market === null
                    ? {}
                    : { market: row.market }),
                },
              ]
        values.set(
          row.id,
          prior === undefined
            ? {
                id: row.id,
                name: row.name,
                type: row.type,
                currency: row.currency,
                status: row.status,
                ...(row.issuer_name === null
                  ? {}
                  : { issuerName: row.issuer_name }),
                identifiers: identifier,
              }
            : { ...prior, identifiers: [...prior.identifiers, ...identifier] }
        )
      }
      return [...values.values()]
    })
  }
}
