import type {
  InvestmentOperationHistoryItem,
  InvestmentQueries,
  ListInvestmentOperationsQuery,
} from "@workspace/application"
import {
  decodeInvestmentOperationCursor,
  encodeInvestmentOperationCursor,
} from "@workspace/application"
import type { SqliteDatabase } from "../../database/index.js"
type Row = {
  id: string
  type: string
  occurred_on: string
  sequence: string
  gross_amount_minor: string
  net_cash_flow_minor: string
  book_cost_delta_minor: string
  journal_entry_id: string | null
  reversal_of_id: string | null
  reversed_by_id: string | null
  replacement_of_id: string | null
  replaced_by_id: string | null
}
export class SqliteInvestmentOperationQueries implements Pick<
  InvestmentQueries,
  "listOperations"
> {
  public constructor(private readonly database: SqliteDatabase) {}
  public async listOperations(query: ListInvestmentOperationsQuery) {
    const fingerprint = `${query.bookId}|${query.positionId}`
    const cursor =
      query.cursor === undefined
        ? undefined
        : decodeInvestmentOperationCursor(query.cursor)
    if (cursor !== undefined && cursor.fingerprint !== fingerprint)
      throw new Error("INVALID_QUERY cursor")
    return this.database.readTransaction(async (reader) => {
      const args: string[] = [query.bookId, query.positionId]
      let where = "book_id=? AND position_id=?"
      if (cursor) {
        where +=
          " AND (occurred_on<? OR (occurred_on=? AND (sequence<? OR (sequence=? AND id<?))))"
        args.push(
          cursor.occurredOn,
          cursor.occurredOn,
          cursor.sequence,
          cursor.sequence,
          cursor.id
        )
      }
      args.push(String(query.limit + 1))
      const rows = await reader.query<Row>(
        `SELECT id,type,occurred_on,CAST(sequence AS TEXT) sequence,CAST(gross_amount_minor AS TEXT) gross_amount_minor,CAST(net_cash_flow_minor AS TEXT) net_cash_flow_minor,CAST(book_cost_delta_minor AS TEXT) book_cost_delta_minor,journal_entry_id,reversal_of_id,reversed_by_id,replacement_of_id,replaced_by_id FROM investment_operations WHERE ${where} ORDER BY occurred_on DESC,sequence DESC,id DESC LIMIT ?`,
        args
      )
      const items: InvestmentOperationHistoryItem[] = rows
        .slice(0, query.limit)
        .map((r) => ({
          id: r.id,
          type: r.type,
          occurredOn: r.occurred_on,
          sequence: r.sequence,
          grossAmountMinor: r.gross_amount_minor,
          netCashFlowMinor: r.net_cash_flow_minor,
          bookCostDeltaMinor: r.book_cost_delta_minor,
          ...(r.journal_entry_id === null
            ? {}
            : { journalEntryId: r.journal_entry_id }),
          ...(r.reversal_of_id === null
            ? {}
            : { reversalOf: r.reversal_of_id }),
          ...(r.reversed_by_id === null
            ? {}
            : { reversedBy: r.reversed_by_id }),
          ...(r.replacement_of_id === null
            ? {}
            : { replacementOf: r.replacement_of_id }),
          ...(r.replaced_by_id === null
            ? {}
            : { replacedBy: r.replaced_by_id }),
        }))
      const next = rows[query.limit]
      return {
        items,
        nextCursor:
          next === undefined
            ? null
            : encodeInvestmentOperationCursor({
                fingerprint,
                occurredOn: next.occurred_on,
                sequence: next.sequence,
                id: next.id,
              }),
      }
    })
  }
}
