import {
  INVESTMENT_INSTRUMENT_TYPES,
  investmentInstrumentClassFor,
} from "@workspace/domain"
import type {
  FixedIncomeTermsSnapshot,
  InvestmentInstrumentType,
} from "@workspace/domain"
import type {
  InvestmentPositionView,
  InvestmentQueries,
  ListInvestmentPositionsQuery,
} from "@workspace/application"
import type { SqliteDatabase } from "../../database/index.js"
import { readInteger } from "../sqlite-query-values.js"
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
  quantity_mode: "UNITS" | "AMOUNT"
  opened_on: string
  closed_on: string | null
  term_position_id: string | null
  rate_kind: string | null
  index_name: string | null
  annual_rate: string | null
  index_percentage: string | null
  annual_spread_rate: string | null
  issue_date: string | null
  grace_period_date: string | null
  maturity_date: string | null
  label: string | null
  normalized_label: string
  quantity: string | null
  book_cost_minor: string
  currency: string
  status: "OPEN" | "CLOSED"
  version: unknown
  allocation_revision: unknown
  valuation_id: string | null
  valued_at: string | null
  gross_value_minor: string | null
  net_value_minor: string | null
  withdrawable_value_minor: string | null
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
      query.positionId ?? "",
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
      const params: string[] = [query.bookId]
      let where = "p.book_id=?"
      if (query.status !== "ALL") {
        where += " AND p.status=?"
        params.push(query.status ?? "OPEN")
      }
      if (query.positionId !== undefined) {
        where += " AND p.id=?"
        params.push(query.positionId)
      }
      if (query.accountId !== undefined) {
        where += " AND p.investment_account_id=?"
        params.push(query.accountId)
      }
      if (query.assetClass !== undefined) {
        const types = INVESTMENT_INSTRUMENT_TYPES.filter(
          (type) => investmentInstrumentClassFor(type) === query.assetClass
        )
        where +=
          types.length === 0
            ? " AND 1=0"
            : ` AND i.type IN (${types.map(() => "?").join(",")})`
        params.push(...types)
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
        `SELECT p.id,p.investment_account_id,p.instrument_id,i.name instrument_name,i.normalized_name,i.type,p.quantity_mode,p.opened_on,p.closed_on,t.position_id term_position_id,t.rate_kind,t.index_name,t.annual_rate,t.index_percentage,t.annual_spread_rate,t.issue_date,t.grace_period_date,t.maturity_date,p.label,p.normalized_label,CAST(p.quantity AS TEXT) quantity,CAST(p.book_cost_minor AS TEXT) book_cost_minor,p.currency,p.status,p.version,p.allocation_revision,v.id valuation_id,v.valued_at,CAST(v.gross_value_minor AS TEXT) gross_value_minor,CAST(v.net_value_minor AS TEXT) net_value_minor,CAST(v.withdrawable_value_minor AS TEXT) withdrawable_value_minor FROM investment_positions p JOIN investment_instruments i ON i.id=p.instrument_id AND i.book_id=p.book_id LEFT JOIN investment_fixed_income_terms t ON t.position_id=p.id AND t.book_id=p.book_id LEFT JOIN investment_valuations v ON v.id=(SELECT x.id FROM investment_valuations x WHERE x.book_id=p.book_id AND x.position_id=p.id AND x.allocation_revision=p.allocation_revision ORDER BY x.valued_at DESC,x.recorded_at DESC,x.record_sequence DESC,x.id DESC LIMIT 1) WHERE ${where} ORDER BY i.normalized_name,p.normalized_label,p.id LIMIT ?`,
        params
      )
      const items: InvestmentPositionView[] = rows
        .slice(0, query.limit)
        .map((row) => ({
          id: row.id,
          investmentAccountId: row.investment_account_id,
          instrumentId: row.instrument_id,
          instrumentName: row.instrument_name,
          assetClass: investmentInstrumentClassFor(
            row.type as InvestmentInstrumentType
          ),
          quantityMode: row.quantity_mode,
          openedOn: row.opened_on,
          ...(row.closed_on === null ? {} : { closedOn: row.closed_on }),
          ...(row.term_position_id === null
            ? {}
            : {
                fixedIncomeTerms: {
                  ...(row.rate_kind === null
                    ? {}
                    : { rateKind: row.rate_kind }),
                  ...(row.index_name === null ? {} : { index: row.index_name }),
                  ...(row.annual_rate === null
                    ? {}
                    : { annualRate: row.annual_rate }),
                  ...(row.index_percentage === null
                    ? {}
                    : { indexPercentage: row.index_percentage }),
                  ...(row.annual_spread_rate === null
                    ? {}
                    : { annualSpreadRate: row.annual_spread_rate }),
                  ...(row.issue_date === null
                    ? {}
                    : { issueDate: row.issue_date }),
                  ...(row.grace_period_date === null
                    ? {}
                    : { gracePeriodDate: row.grace_period_date }),
                  ...(row.maturity_date === null
                    ? {}
                    : { maturityDate: row.maturity_date }),
                } as FixedIncomeTermsSnapshot,
              }),
          ...(row.label === null ? {} : { label: row.label }),
          ...(row.quantity === null ? {} : { quantity: row.quantity }),
          bookCostMinor: row.book_cost_minor,
          currency: row.currency,
          status: row.status,
          allocationRevision: readInteger(
            row.allocation_revision,
            "allocation_revision"
          ),
          version: readInteger(row.version, "version"),
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
                    ...(row.net_value_minor === null
                      ? {}
                      : { netValueMinor: row.net_value_minor }),
                    ...(row.withdrawable_value_minor === null
                      ? {}
                      : {
                          withdrawableValueMinor: row.withdrawable_value_minor,
                        }),
                  },
        }))
      const lastRow = rows[query.limit - 1]
      return {
        items,
        nextCursor:
          rows.length <= query.limit || lastRow === undefined
            ? null
            : encodeInvestmentPositionCursor({
                fingerprint,
                name: lastRow.normalized_name,
                label: lastRow.normalized_label,
                id: lastRow.id,
              }),
      }
    })
  }
}
