import type {
  InvestmentPositionView,
  InvestmentQueries,
  ListInvestmentPositionsQuery,
} from "@workspace/application"
import type { SqliteDatabase } from "../../database/index.js"
import {
  decodeInvestmentPositionCursor,
  encodeInvestmentPositionCursor,
} from "@workspace/application"

type Row = {
  id: string
  investment_account_id: string
  instrument_id: string
  instrument_name: string
  normalized_name: string
  type: string
  label: string | null
  normalized_label: string
  quantity: string | null
  book_cost_minor: string
  currency: string
  status: "OPEN" | "CLOSED"
  allocation_revision: number
  valuation_id: string | null
  valued_at: string | null
  gross_value_minor: string | null
}
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")
/** Paged, book-scoped position list; valuation detail is resolved by its dedicated query. */
export class SqliteInvestmentPositionQueries implements Pick<
  InvestmentQueries,
  "listPositions"
> {
  public constructor(private readonly database: SqliteDatabase) {}
  public async listPositions(query: ListInvestmentPositionsQuery) {
    const fingerprint = [
      query.bookId,
      query.accountId ?? "",
      query.assetClass ?? "",
      query.status ?? "OPEN",
      query.search ?? "",
    ].join("|")
    const cursor =
      query.cursor === undefined
        ? undefined
        : decodeInvestmentPositionCursor(query.cursor)
    if (cursor !== undefined && cursor.fingerprint !== fingerprint)
      throw new Error("INVALID_QUERY cursor")
    return this.database.readTransaction(async (reader) => {
      const params: string[] = [query.bookId, query.status ?? "OPEN"]
      let where = "p.book_id=? AND p.status=?"
      if (query.accountId !== undefined) {
        where += " AND p.investment_account_id=?"
        params.push(query.accountId)
      }
      if (query.assetClass !== undefined) {
        where += " AND i.type=?"
        params.push(query.assetClass)
      }
      if (query.search !== undefined) {
        where +=
          " AND (i.normalized_name LIKE ? ESCAPE '\\' OR p.normalized_label LIKE ? ESCAPE '\\')"
        const term = `%${escapeLike(query.search.toLowerCase())}%`
        params.push(term, term)
      }
      if (cursor !== undefined) {
        where +=
          " AND (i.normalized_name>? OR (i.normalized_name=? AND (p.normalized_label>? OR (p.normalized_label=? AND p.id>?))))"
        params.push(
          cursor.name,
          cursor.name,
          cursor.label,
          cursor.label,
          cursor.id
        )
      }
      params.push(String(query.limit + 1))
      const rows = await reader.query<Row>(
        `SELECT p.id,p.investment_account_id,p.instrument_id,i.name instrument_name,i.normalized_name,i.type,p.label,p.normalized_label,CAST(p.quantity AS TEXT) quantity,CAST(p.book_cost_minor AS TEXT) book_cost_minor,p.currency,p.status,p.allocation_revision,v.id valuation_id,v.valued_at,CAST(v.gross_value_minor AS TEXT) gross_value_minor FROM investment_positions p JOIN investment_instruments i ON i.id=p.instrument_id AND i.book_id=p.book_id LEFT JOIN investment_valuations v ON v.id=(SELECT x.id FROM investment_valuations x WHERE x.book_id=p.book_id AND x.position_id=p.id AND x.allocation_revision=p.allocation_revision ORDER BY x.valued_at DESC,x.recorded_at DESC,x.record_sequence DESC,x.id DESC LIMIT 1) WHERE ${where} ORDER BY i.normalized_name,p.normalized_label,p.id LIMIT ?`,
        params
      )
      const items: InvestmentPositionView[] = rows
        .slice(0, query.limit)
        .map((row) => ({
          id: row.id,
          investmentAccountId: row.investment_account_id,
          instrumentId: row.instrument_id,
          instrumentName: row.instrument_name,
          assetClass: row.type,
          ...(row.label === null ? {} : { label: row.label }),
          ...(row.quantity === null ? {} : { quantity: row.quantity }),
          bookCostMinor: row.book_cost_minor,
          currency: row.currency,
          status: row.status,
          allocationRevision: row.allocation_revision,
          valuation:
            row.status === "CLOSED"
              ? { basis: "CLOSED", currentValueMinor: "0" }
              : row.valuation_id === null
                ? { basis: "BOOK_COST", currentValueMinor: row.book_cost_minor }
                : {
                    basis: "VALUATION",
                    currentValueMinor: row.gross_value_minor!,
                    valuationId: row.valuation_id,
                    valuedAt: row.valued_at!,
                  },
        }))
      const last = items.at(-1)
      const source = rows[query.limit]
      return {
        items,
        nextCursor:
          source === undefined || last === undefined
            ? null
            : encodeInvestmentPositionCursor({
                fingerprint,
                name: source.normalized_name,
                label: source.normalized_label,
                id: source.id,
              }),
      }
    })
  }
}
