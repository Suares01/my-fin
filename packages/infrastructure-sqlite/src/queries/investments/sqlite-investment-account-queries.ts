import type {
  InvestmentAccountDetailView,
  InvestmentAccountQueries,
  InvestmentAccountQueryInput,
  InvestmentAccountView,
  InvestmentWarning,
} from "@workspace/application"
import type { SqliteDatabase, SqliteReader } from "../../database/index.js"
import { readBigInt, readString } from "../sqlite-query-values.js"

const PAGE_SIZE = 512
type AccountRow = {
  readonly id: unknown
  readonly name: unknown
  readonly status: unknown
  readonly institution_name: unknown
  readonly display_reference: unknown
  readonly default_settlement_account_id: unknown
}
type PositionRow = {
  readonly id: unknown
  readonly investment_account_id: unknown
  readonly book_cost_minor: unknown
  readonly status: unknown
  readonly allocation_revision: unknown
}
type ValuationRow = {
  readonly position_id: unknown
  readonly allocation_revision: unknown
  readonly valued_at: unknown
  readonly recorded_at: unknown
  readonly record_sequence: unknown
  readonly gross_value_minor: unknown
}
type PostingRow = {
  readonly posting_id: unknown
  readonly account_id: unknown
  readonly amount_minor: unknown
}

/** Reads account cards and detail summaries without loading operation history. */
export class SqliteInvestmentAccountQueries implements InvestmentAccountQueries {
  public constructor(private readonly database: SqliteDatabase) {}

  public async listInvestmentAccounts(
    input: InvestmentAccountQueryInput
  ): Promise<readonly InvestmentAccountView[]> {
    return this.database.readTransaction((reader) => this.read(reader, input))
  }

  public async getInvestmentAccountDetail(
    input: InvestmentAccountQueryInput & { readonly accountId: string }
  ): Promise<InvestmentAccountDetailView | null> {
    return this.database.readTransaction(async (reader) => {
      const rows = await this.read(reader, input)
      const item = rows.find((row) => row.id === input.accountId)
      if (item === undefined) return null
      const counts = (
        await reader.query<{
          readonly position_count: unknown
          readonly open_position_count: unknown
        }>(
          "SELECT COUNT(*) AS position_count, SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_position_count FROM investment_positions WHERE book_id = ? AND investment_account_id = ?",
          [input.bookId, input.accountId]
        )
      )[0]
      return {
        ...item,
        positionCount: Number(
          readBigInt(counts?.position_count ?? 0, "position_count")
        ),
        openPositionCount: Number(
          readBigInt(counts?.open_position_count ?? 0, "open_position_count")
        ),
        warnings: item.cashMinor.startsWith("-")
          ? [
              {
                code: "INVESTMENT_CASH_NEGATIVE",
                investmentAccountId: item.id,
                cashMinor: item.cashMinor,
                currency: item.currency,
                asOf: input.asOf,
              },
            ]
          : [],
      }
    })
  }

  private async read(
    reader: SqliteReader,
    input: InvestmentAccountQueryInput
  ): Promise<readonly InvestmentAccountView[]> {
    const [accounts, positions, valuations, balances] = await Promise.all([
      reader.query<AccountRow>(
        "SELECT a.id, a.name, a.status, fa.institution_name, fa.display_reference, ia.default_settlement_account_id FROM investment_accounts ia JOIN ledger_accounts a ON a.id = ia.ledger_account_id AND a.book_id = ia.book_id JOIN financial_accounts fa ON fa.ledger_account_id = ia.ledger_account_id AND fa.book_id = ia.book_id WHERE ia.book_id = ? ORDER BY a.normalized_name ASC, a.id ASC",
        [input.bookId]
      ),
      reader.query<PositionRow>(
        "SELECT id, investment_account_id, CAST(book_cost_minor AS TEXT) AS book_cost_minor, status, allocation_revision FROM investment_positions WHERE book_id = ?",
        [input.bookId]
      ),
      reader.query<ValuationRow>(
        "SELECT position_id, allocation_revision, valued_at, recorded_at, record_sequence, CAST(gross_value_minor AS TEXT) AS gross_value_minor FROM investment_valuations WHERE book_id = ? AND valued_on <= ?",
        [input.bookId, input.asOf]
      ),
      this.balances(reader, input.bookId, input.asOf),
    ])
    const current = new Map<string, ValuationRow>()
    const revisions = new Map(
      positions.map((row) => [
        readString(row.id, "position.id"),
        Number(readBigInt(row.allocation_revision, "allocation_revision")),
      ])
    )
    for (const valuation of valuations) {
      const positionId = readString(valuation.position_id, "position_id")
      if (
        revisions.get(positionId) !==
        Number(readBigInt(valuation.allocation_revision, "allocation_revision"))
      )
        continue
      const previous = current.get(positionId)
      const key = `${readString(valuation.valued_at, "valued_at")}\u0000${readString(valuation.recorded_at, "recorded_at")}\u0000${String(readBigInt(valuation.record_sequence, "record_sequence")).padStart(20, "0")}`
      const previousKey =
        previous === undefined
          ? ""
          : `${readString(previous.valued_at, "valued_at")}\u0000${readString(previous.recorded_at, "recorded_at")}\u0000${String(readBigInt(previous.record_sequence, "record_sequence")).padStart(20, "0")}`
      if (key > previousKey) current.set(positionId, valuation)
    }
    const totals = new Map<string, { cost: bigint; value: bigint }>()
    for (const position of positions) {
      if (readString(position.status, "position.status") !== "OPEN") continue
      const accountId = readString(
        position.investment_account_id,
        "investment_account_id"
      )
      const cost = readBigInt(position.book_cost_minor, "book_cost_minor")
      const total = totals.get(accountId) ?? { cost: 0n, value: 0n }
      total.cost += cost
      total.value +=
        current.get(readString(position.id, "position.id")) === undefined
          ? cost
          : readBigInt(
              current.get(readString(position.id, "position.id"))
                ?.gross_value_minor,
              "gross_value_minor"
            )
      totals.set(accountId, total)
    }
    return accounts.map((account) => {
      const id = readString(account.id, "account.id")
      const total = totals.get(id) ?? { cost: 0n, value: 0n }
      const ledger = balances.get(id) ?? 0n
      return {
        id,
        name: readString(account.name, "account.name"),
        currency: input.currency,
        status: readString(account.status, "account.status") as
          | "ACTIVE"
          | "ARCHIVED",
        ...(account.institution_name === null
          ? {}
          : {
              institutionName: readString(
                account.institution_name,
                "institution_name"
              ),
            }),
        ...(account.display_reference === null
          ? {}
          : {
              displayReference: readString(
                account.display_reference,
                "display_reference"
              ),
            }),
        ...(account.default_settlement_account_id === null
          ? {}
          : {
              defaultSettlementAccountId: readString(
                account.default_settlement_account_id,
                "default_settlement_account_id"
              ),
            }),
        ledgerBalanceMinor: ledger.toString(),
        positionCostMinor: total.cost.toString(),
        cashMinor: (ledger - total.cost).toString(),
        marketValueMinor: (ledger + total.value - total.cost).toString(),
        unrealizedResultMinor: (total.value - total.cost).toString(),
      }
    })
  }

  private async balances(
    reader: SqliteReader,
    bookId: string,
    asOf: string
  ): Promise<Map<string, bigint>> {
    const totals = new Map<string, bigint>()
    let afterId = ""
    for (;;) {
      const rows = await reader.query<PostingRow>(
        "SELECT p.id AS posting_id, p.account_id, CAST(p.amount_minor AS TEXT) AS amount_minor FROM postings p JOIN journal_entries e ON e.id = p.journal_entry_id AND e.book_id = p.book_id WHERE p.book_id = ? AND p.id > ? AND e.occurred_on <= ? ORDER BY p.id ASC LIMIT ?",
        [bookId, afterId, asOf, String(PAGE_SIZE)]
      )
      for (const row of rows) {
        const id = readString(row.account_id, "account_id")
        totals.set(
          id,
          (totals.get(id) ?? 0n) + readBigInt(row.amount_minor, "amount_minor")
        )
      }
      if (rows.length < PAGE_SIZE) return totals
      afterId = readString(rows.at(-1)?.posting_id, "posting_id")
    }
  }
}
