import type {
  InvestmentQueries,
  InvestmentValuationHistoryItem,
  ListInvestmentValuationsQuery,
} from "@workspace/application"
import {
  decodeInvestmentValuationCursor,
  encodeInvestmentValuationCursor,
} from "@workspace/application"
import type { SqliteDatabase } from "../../database/index.js"
type Row = {
  id: string
  valued_at: string
  recorded_at: string
  record_sequence: string
  allocation_revision: number
  currency: string
  quantity: string | null
  unit_price: string | null
  gross_value_minor: string
  net_value_minor: string | null
  withdrawable_value_minor: string | null
}
export class SqliteInvestmentValuationQueries implements Pick<
  InvestmentQueries,
  "listValuations"
> {
  public constructor(private readonly database: SqliteDatabase) {}
  public async listValuations(query: ListInvestmentValuationsQuery) {
    const fingerprint = `${query.bookId}|${query.positionId}`
    const cursor =
      query.cursor === undefined
        ? undefined
        : decodeInvestmentValuationCursor(query.cursor)
    if (cursor && cursor.fingerprint !== fingerprint)
      throw new Error("INVALID_QUERY cursor")
    return this.database.readTransaction(async (reader) => {
      const args: string[] = [query.bookId, query.positionId]
      let where = "book_id=? AND position_id=?"
      if (cursor) {
        where +=
          " AND (valued_at<? OR (valued_at=? AND (record_sequence<? OR (record_sequence=? AND id<?))))"
        args.push(
          cursor.valuedAt,
          cursor.valuedAt,
          cursor.sequence,
          cursor.sequence,
          cursor.id
        )
      }
      args.push(String(query.limit + 1))
      const rows = await reader.query<Row>(
        `SELECT id,valued_at,recorded_at,CAST(record_sequence AS TEXT) record_sequence,allocation_revision,currency,quantity,unit_price,CAST(gross_value_minor AS TEXT) gross_value_minor,CAST(net_value_minor AS TEXT) net_value_minor,CAST(withdrawable_value_minor AS TEXT) withdrawable_value_minor FROM investment_valuations WHERE ${where} ORDER BY valued_at DESC,record_sequence DESC,id DESC LIMIT ?`,
        args
      )
      const items: InvestmentValuationHistoryItem[] = rows
        .slice(0, query.limit)
        .map((r) => ({
          id: r.id,
          valuedAt: r.valued_at,
          recordedAt: r.recorded_at,
          recordSequence: r.record_sequence,
          allocationRevision: r.allocation_revision,
          currency: r.currency,
          ...(r.quantity === null ? {} : { quantity: r.quantity }),
          ...(r.unit_price === null ? {} : { unitPrice: r.unit_price }),
          grossValueMinor: r.gross_value_minor,
          ...(r.net_value_minor === null
            ? {}
            : { netValueMinor: r.net_value_minor }),
          ...(r.withdrawable_value_minor === null
            ? {}
            : { withdrawableValueMinor: r.withdrawable_value_minor }),
        }))
      const next = rows[query.limit]
      return {
        items,
        nextCursor:
          next === undefined
            ? null
            : encodeInvestmentValuationCursor({
                fingerprint,
                valuedAt: next.valued_at,
                sequence: next.record_sequence,
                id: next.id,
              }),
      }
    })
  }
}
