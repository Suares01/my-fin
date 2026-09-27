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
  role: "BUSINESS" | "REVERSAL"
  version: number
  occurred_on: string
  settled_on: string | null
  recorded_at: string
  sequence: string
  description: string
  currency: string
  quantity_delta: string | null
  gross_amount_minor: string
  net_cash_flow_minor: string
  book_cost_delta_minor: string
  fees_minor: string
  taxes_minor: string
  cash_mode: "NONE" | "INTERNAL_CASH" | "EXTERNAL_ACCOUNT"
  settlement_account_id: string | null
  gain_category_id: string | null
  loss_category_id: string | null
  income_category_id: string | null
  fee_category_id: string | null
  tax_category_id: string | null
  before_kind: "UNOPENED" | "EXISTING"
  before_quantity: string | null
  before_book_cost_minor: string | null
  before_status: "OPEN" | "CLOSED" | null
  before_opened_on: string | null
  before_closed_on: string | null
  before_allocation_effective_on: string | null
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
        `SELECT id,type,role,version,occurred_on,settled_on,recorded_at,CAST(sequence AS TEXT) sequence,description,currency,quantity_delta,CAST(gross_amount_minor AS TEXT) gross_amount_minor,CAST(net_cash_flow_minor AS TEXT) net_cash_flow_minor,CAST(book_cost_delta_minor AS TEXT) book_cost_delta_minor,CAST(fees_minor AS TEXT) fees_minor,CAST(taxes_minor AS TEXT) taxes_minor,cash_mode,settlement_account_id,gain_category_id,loss_category_id,income_category_id,fee_category_id,tax_category_id,before_kind,before_quantity,CAST(before_book_cost_minor AS TEXT) before_book_cost_minor,before_status,before_opened_on,before_closed_on,before_allocation_effective_on,journal_entry_id,reversal_of_id,reversed_by_id,replacement_of_id,replaced_by_id FROM investment_operations WHERE ${where} ORDER BY occurred_on DESC,sequence DESC,id DESC LIMIT ?`,
        args
      )
      const items: InvestmentOperationHistoryItem[] = rows
        .slice(0, query.limit)
        .map((r) => ({
          id: r.id,
          type: r.type,
          role: r.role,
          version: r.version,
          ...(r.settled_on === null ? {} : { settledOn: r.settled_on }),
          recordedAt: r.recorded_at,
          description: r.description,
          currency: r.currency,
          ...(r.quantity_delta === null
            ? {}
            : { quantityDelta: r.quantity_delta }),
          feesMinor: r.fees_minor,
          taxesMinor: r.taxes_minor,
          cashMode: r.cash_mode,
          ...(r.settlement_account_id === null
            ? {}
            : { settlementAccountId: r.settlement_account_id }),
          ...(r.gain_category_id === null
            ? {}
            : { gainCategoryId: r.gain_category_id }),
          ...(r.loss_category_id === null
            ? {}
            : { lossCategoryId: r.loss_category_id }),
          ...(r.income_category_id === null
            ? {}
            : { incomeCategoryId: r.income_category_id }),
          ...(r.fee_category_id === null
            ? {}
            : { feeCategoryId: r.fee_category_id }),
          ...(r.tax_category_id === null
            ? {}
            : { taxCategoryId: r.tax_category_id }),
          beforeKind: r.before_kind,
          ...(r.before_quantity === null
            ? {}
            : { beforeQuantity: r.before_quantity }),
          ...(r.before_book_cost_minor === null
            ? {}
            : { beforeBookCostMinor: r.before_book_cost_minor }),
          ...(r.before_status === null
            ? {}
            : { beforeStatus: r.before_status }),
          ...(r.before_opened_on === null
            ? {}
            : { beforeOpenedOn: r.before_opened_on }),
          ...(r.before_closed_on === null
            ? {}
            : { beforeClosedOn: r.before_closed_on }),
          ...(r.before_allocation_effective_on === null
            ? {}
            : {
                beforeAllocationEffectiveOn: r.before_allocation_effective_on,
              }),
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
