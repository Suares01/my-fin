import type {
  InvestmentCashState,
  InvestmentTransactionReads,
} from "@workspace/application"
import type { LedgerAccountId } from "@workspace/domain"
import type { SqliteReader } from "../database/sqlite-executor.js"
import { readBigInt, readString } from "./sqlite-query-values.js"
import { SqliteExactLedgerTotals } from "./sqlite-exact-ledger-totals.js"

type CurrencyRow = { readonly base_currency: unknown }
type PositionCostRow = {
  readonly investment_account_id: unknown
  readonly book_cost_minor: unknown
}

/** Reads investment write-state with the caller's current transaction reader. */
export class SqliteInvestmentTransactionReads implements InvestmentTransactionReads {
  private readonly totals: SqliteExactLedgerTotals

  public constructor(private readonly reader: SqliteReader) {
    this.totals = new SqliteExactLedgerTotals(reader)
  }

  public async hasActiveSettlementDependents(
    bookId: string,
    accountId: LedgerAccountId
  ): Promise<boolean> {
    const rows = await this.reader.query<{ readonly present: number }>(
      "SELECT 1 AS present FROM investment_accounts ia " +
        "JOIN ledger_accounts a ON a.id = ia.ledger_account_id " +
        "AND a.book_id = ia.book_id " +
        "WHERE ia.book_id = ? AND ia.default_settlement_account_id = ? " +
        "AND a.status = 'ACTIVE' LIMIT 1",
      [bookId, accountId]
    )
    return rows.length > 0
  }

  public accountLedgerBalance(
    bookId: string,
    accountId: LedgerAccountId,
    asOf?: string
  ): Promise<string> {
    return this.totals.sum({
      bookId,
      accountIds: [accountId],
      ...(asOf === undefined ? {} : { asOf }),
    })
  }

  public async accountCash(
    bookId: string,
    accountIds: readonly LedgerAccountId[],
    asOf: string
  ): Promise<readonly InvestmentCashState[]> {
    if (accountIds.length === 0) return []

    const currency = await this.currency(bookId)
    const costs = await this.positionCosts(bookId, accountIds)
    return Promise.all(
      accountIds.map(async (investmentAccountId) => {
        const ledgerMinor = await this.accountLedgerBalance(
          bookId,
          investmentAccountId,
          asOf
        )
        return {
          investmentAccountId,
          cashMinor: (
            BigInt(ledgerMinor) - (costs.get(investmentAccountId) ?? 0n)
          ).toString(),
          currency,
        }
      })
    )
  }

  private async currency(bookId: string): Promise<string> {
    const rows = await this.reader.query<CurrencyRow>(
      "SELECT base_currency FROM financial_books WHERE id = ?",
      [bookId]
    )
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Financial book ${bookId} was not found`)
    }
    return readString(row.base_currency, "base_currency")
  }

  private async positionCosts(
    bookId: string,
    accountIds: readonly LedgerAccountId[]
  ): Promise<Map<string, bigint>> {
    const rows = await this.reader.query<PositionCostRow>(
      "SELECT investment_account_id, CAST(book_cost_minor AS TEXT) AS book_cost_minor " +
        "FROM investment_positions WHERE book_id = ? AND investment_account_id IN (" +
        accountIds.map(() => "?").join(", ") +
        ")",
      [bookId, ...accountIds]
    )
    return rows.reduce((costs, row) => {
      const id = readString(row.investment_account_id, "investment_account_id")
      costs.set(
        id,
        (costs.get(id) ?? 0n) +
          readBigInt(row.book_cost_minor, "book_cost_minor")
      )
      return costs
    }, new Map<string, bigint>())
  }
}
