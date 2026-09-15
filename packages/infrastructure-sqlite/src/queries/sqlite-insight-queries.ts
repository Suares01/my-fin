import type {
  CategorySpendingItem,
  GetCategorySpendingInput,
  GetMonthlyCashFlowInput,
  GetNetWorthInput,
  InsightQueries,
  MonthlyCashFlowItem,
  NetWorthView,
} from "@workspace/application"
import type { SqliteDatabase, SqliteReader } from "../database/index.js"
import {
  readAccountKind,
  readAccountStatus,
  readBigInt,
  readInteger,
  readString,
  toDisplayMinor,
} from "./sqlite-query-values.js"

export class SqliteInsightQueries implements InsightQueries {
  public constructor(private readonly database: SqliteDatabase) {}

  public async getMonthlyCashFlow(
    input: GetMonthlyCashFlowInput
  ): Promise<readonly MonthlyCashFlowItem[]> {
    return this.database.readTransaction(async (reader) => {
      const rows = await reader.query<MonthlyCashFlowRow>(
        "SELECT b.base_currency, substr(e.occurred_on, 1, 7) AS month, " +
          "a.kind AS account_kind, " +
          "CAST(p.amount_minor AS TEXT) AS amount_minor " +
          "FROM financial_books b " +
          "LEFT JOIN journal_entries e ON e.book_id = b.id " +
          "AND e.occurred_on >= ? AND e.occurred_on < ? " +
          "LEFT JOIN postings p ON p.book_id = e.book_id " +
          "AND p.journal_entry_id = e.id " +
          "LEFT JOIN ledger_accounts a ON a.book_id = p.book_id " +
          "AND a.id = p.account_id " +
          "AND a.kind IN ('INCOME', 'EXPENSE') " +
          "WHERE b.id = ? " +
          "ORDER BY month ASC, a.kind ASC, p.id ASC",
        [`${input.fromMonth}-01`, monthAfter(input.toMonth), input.bookId]
      )
      const currency =
        rows[0] === undefined
          ? await this.readBookCurrency(reader, input.bookId)
          : readString(rows[0].base_currency, "base_currency")
      const totals = new Map<string, { income: bigint; expense: bigint }>()
      for (const row of rows) {
        if (row.month === null || row.account_kind === null) {
          continue
        }
        const month = readString(row.month, "month")
        const current = totals.get(month) ?? { income: 0n, expense: 0n }
        const amount = readBigInt(row.amount_minor, "amount_minor")
        const kind = readAccountKind(row.account_kind)
        if (kind === "INCOME") {
          current.income += BigInt(toDisplayMinor(amount, kind))
        } else {
          current.expense += BigInt(toDisplayMinor(amount, kind))
        }
        totals.set(month, current)
      }

      const result: MonthlyCashFlowItem[] = []
      for (const month of monthsBetween(input.fromMonth, input.toMonth)) {
        const total = totals.get(month) ?? { income: 0n, expense: 0n }
        result.push({
          month,
          incomeMinor: total.income.toString(),
          expenseMinor: total.expense.toString(),
          netMinor: (total.income - total.expense).toString(),
          currency,
        })
      }
      return result
    })
  }

  public async getCategorySpending(
    input: GetCategorySpendingInput
  ): Promise<readonly CategorySpendingItem[]> {
    const parameters: (string | null)[] = [
      input.bookId,
      input.from.value,
      input.to.value,
    ]
    let sql =
      "SELECT a.id AS category_id, a.name AS category_name, a.status, " +
      "CAST(p.amount_minor AS TEXT) AS amount_minor, e.id AS entry_id, e.reversal_of_id " +
      "FROM ledger_accounts a " +
      "JOIN postings p ON p.book_id = a.book_id AND p.account_id = a.id " +
      "JOIN journal_entries e ON e.book_id = p.book_id " +
      "AND e.id = p.journal_entry_id " +
      "WHERE a.book_id = ? AND a.kind = 'EXPENSE' " +
      "AND e.occurred_on >= ? AND e.occurred_on <= ?"

    if (input.categoryId !== undefined) {
      sql += " AND a.id = ?"
      parameters.push(input.categoryId)
    }

    sql += " ORDER BY a.id ASC, p.id ASC"
    const rows = await this.database.query<CategorySpendingRow>(sql, parameters)
    const grouped = new Map<
      string,
      {
        categoryId: string
        categoryName: string
        amount: bigint
        entries: Set<string>
        archived: boolean
      }
    >()
    for (const row of rows) {
      const categoryId = readString(row.category_id, "category_id")
      const current = grouped.get(categoryId) ?? {
        categoryId,
        categoryName: readString(row.category_name, "category_name"),
        amount: 0n,
        entries: new Set<string>(),
        archived: readAccountStatus(row.status) === "ARCHIVED",
      }
      current.amount += readBigInt(row.amount_minor, "amount_minor")
      if (
        readBigInt(row.amount_minor, "amount_minor") > 0n &&
        row.reversal_of_id === null
      )
        current.entries.add(readString(row.entry_id, "entry_id"))
      grouped.set(categoryId, current)
    }
    const values = [...grouped.values()].map((value) => ({
      ...value,
      transactionCount: value.entries.size,
    }))
    const denominator = values.reduce(
      (sum, value) => sum + (value.amount > 0n ? value.amount : 0n),
      0n
    )

    return values
      .sort((left, right) => {
        if (left.amount !== right.amount) {
          return left.amount > right.amount ? -1 : 1
        }
        const nameOrder = left.categoryName.localeCompare(right.categoryName)
        return nameOrder !== 0
          ? nameOrder
          : left.categoryId.localeCompare(right.categoryId)
      })
      .map((value) => ({
        categoryId: value.categoryId,
        categoryName: value.categoryName,
        amountMinor: value.amount.toString(),
        percentageBasisPoints:
          denominator === 0n
            ? 0
            : Number(
                (BigInt(value.amount > 0n ? value.amount : 0n) * 10000n) /
                  denominator
              ),
        transactionCount: value.transactionCount,
        archived: value.archived,
      }))
  }

  public async getNetWorth(input: GetNetWorthInput): Promise<NetWorthView> {
    return this.database.readTransaction(async (reader) => {
      const exact = await this.readExactKindTotals(
        reader,
        input.bookId,
        input.asOf?.value
      )
      const currency = await this.readBookCurrency(reader, input.bookId)
      const assetMinor = exact.get("ASSET") ?? 0n
      const liabilityMinor = -(exact.get("LIABILITY") ?? 0n)
      return {
        assetMinor: assetMinor.toString(),
        liabilityMinor: liabilityMinor.toString(),
        netWorthMinor: (assetMinor - liabilityMinor).toString(),
        currency,
        asOf: input.asOf?.value ?? null,
      }
    })
    /*
    const parameters: (string | null)[] = []
    let sql =
      "SELECT b.base_currency, a.kind AS account_kind, " +
      "CAST(COALESCE(SUM(CASE WHEN e.id IS NOT NULL " +
      "THEN p.amount_minor ELSE 0 END), 0) AS TEXT) AS raw_balance_minor " +
      "FROM financial_books b " +
      "LEFT JOIN ledger_accounts a ON a.book_id = b.id " +
      "AND a.kind IN ('ASSET', 'LIABILITY') " +
      "LEFT JOIN postings p ON p.book_id = a.book_id AND p.account_id = a.id " +
      "LEFT JOIN journal_entries e ON e.book_id = p.book_id " +
      "AND e.id = p.journal_entry_id"
    if (input.asOf !== undefined) {
      sql += " AND e.occurred_on <= ?"
      parameters.push(input.asOf.value)
    }
    sql += " WHERE b.id = ? GROUP BY b.base_currency, a.kind"
    parameters.push(input.bookId)

    const rows = await this.database.query<NetWorthRow>(sql, parameters)
    let assetMinor = 0n
    let liabilityMinor = 0n
    let currency = ""
    for (const row of rows) {
      currency = readString(row.base_currency, "base_currency")
      if (row.account_kind === null) {
        continue
      }
      const kind = readAccountKind(row.account_kind)
      const displayBalance = BigInt(
        toDisplayMinor(
          readBigInt(row.raw_balance_minor, "raw_balance_minor"),
          kind
        )
      )
      if (kind === "ASSET") {
        assetMinor += displayBalance
      } else {
        liabilityMinor += displayBalance
      }
    }

    if (currency.length === 0) {
      throw new Error(`Financial book ${input.bookId} was not found`)
    }
    return {
      assetMinor: assetMinor.toString(),
      liabilityMinor: liabilityMinor.toString(),
      netWorthMinor: (assetMinor - liabilityMinor).toString(),
      currency,
      asOf: input.asOf?.value ?? null,
    }
    */
  }

  private async readExactKindTotals(
    reader: SqliteReader,
    bookId: string,
    asOf?: string
  ): Promise<Map<string, bigint>> {
    const totals = new Map<string, bigint>()
    let afterId = ""
    for (;;) {
      const params =
        asOf === undefined
          ? [bookId, afterId, "512"]
          : [bookId, afterId, asOf, "512"]
      const rows = await reader.query<{
        readonly id: unknown
        readonly kind: unknown
        readonly amount_minor: unknown
      }>(
        "SELECT p.id,a.kind,CAST(p.amount_minor AS TEXT) amount_minor FROM postings p JOIN journal_entries e ON e.id=p.journal_entry_id AND e.book_id=p.book_id JOIN ledger_accounts a ON a.id=p.account_id AND a.book_id=p.book_id WHERE p.book_id=? AND p.id>?" +
          (asOf === undefined ? "" : " AND e.occurred_on<=?") +
          " AND a.kind IN ('ASSET','LIABILITY') ORDER BY p.id LIMIT ?",
        params
      )
      for (const row of rows) {
        const kind = readString(row.kind, "kind")
        totals.set(
          kind,
          (totals.get(kind) ?? 0n) +
            readBigInt(row.amount_minor, "amount_minor")
        )
      }
      if (rows.length < 512) return totals
      afterId = readString(rows.at(-1)?.id, "id")
    }
  }

  private async readBookCurrency(
    reader: SqliteReader,
    bookId: string
  ): Promise<string> {
    const rows = await reader.query<{ readonly base_currency: unknown }>(
      "SELECT base_currency FROM financial_books WHERE id = ?",
      [bookId]
    )
    const currency = rows[0]?.base_currency
    if (currency === undefined) {
      throw new Error(`Financial book ${bookId} was not found`)
    }
    return readString(currency, "base_currency")
  }
}

type MonthlyCashFlowRow = {
  readonly base_currency: unknown
  readonly month: unknown
  readonly account_kind: unknown
  readonly amount_minor: unknown
}

type CategorySpendingRow = {
  readonly category_id: unknown
  readonly category_name: unknown
  readonly status: unknown
  readonly amount_minor: unknown
  readonly transaction_count: unknown
  readonly entry_id: unknown
  readonly reversal_of_id: unknown
}

type NetWorthRow = {
  readonly base_currency: unknown
  readonly account_kind: unknown
  readonly raw_balance_minor: unknown
}

function monthAfter(month: string): string {
  const [yearText, monthText] = month.split("-")
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  return monthNumber === 12
    ? `${year + 1}-01-01`
    : `${yearText}-${String(monthNumber + 1).padStart(2, "0")}-01`
}

function monthsBetween(from: string, to: string): readonly string[] {
  const result: string[] = []
  let current = from
  while (current <= to) {
    result.push(current)
    current = current.endsWith("12")
      ? `${Number(current.slice(0, 4)) + 1}-01`
      : `${current.slice(0, 5)}${String(Number(current.slice(5)) + 1).padStart(2, "0")}`
  }
  return result
}
