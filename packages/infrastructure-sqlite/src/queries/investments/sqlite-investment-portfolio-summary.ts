import type {
  GetInvestmentPortfolioSummaryInput,
  InvestmentPortfolioSummary,
  InvestmentPortfolioSummaryQueries,
  InvestmentWarning,
} from "@workspace/application"
import type { SqliteDatabase, SqliteReader } from "../../database/index.js"
import {
  readAccountKind,
  readAccountStatus,
  readBigInt,
  readInteger,
  readString,
  toDisplayMinor,
} from "../sqlite-query-values.js"

const PAGE_SIZE = 512

type AccountRow = {
  readonly id: unknown
  readonly kind: unknown
  readonly status: unknown
  readonly financial_type: unknown
}
type PostingRow = {
  readonly posting_id: unknown
  readonly account_id: unknown
  readonly amount_minor: unknown
}
type PositionRow = {
  readonly id: unknown
  readonly investment_account_id: unknown
  readonly book_cost_minor: unknown
  readonly status: unknown
  readonly allocation_revision: unknown
}
type ValuationRow = {
  readonly id: unknown
  readonly position_id: unknown
  readonly allocation_revision: unknown
  readonly valued_at: unknown
  readonly valued_on: unknown
  readonly recorded_at: unknown
  readonly record_sequence: unknown
  readonly gross_value_minor: unknown
}

/** Consistent, exact investment portfolio projection for one book date. */
export class SqliteInvestmentPortfolioSummary implements InvestmentPortfolioSummaryQueries {
  public constructor(private readonly database: SqliteDatabase) {}

  public async getPortfolioSummary(
    input: GetInvestmentPortfolioSummaryInput
  ): Promise<InvestmentPortfolioSummary> {
    return this.database.readTransaction((reader) => this.read(reader, input))
  }

  private async read(
    reader: SqliteReader,
    input: GetInvestmentPortfolioSummaryInput
  ): Promise<InvestmentPortfolioSummary> {
    const accounts = await reader.query<AccountRow>(
      "SELECT a.id, a.kind, a.status, fa.type AS financial_type " +
        "FROM ledger_accounts a LEFT JOIN financial_accounts fa " +
        "ON fa.ledger_account_id = a.id AND fa.book_id = a.book_id " +
        "WHERE a.book_id = ?",
      [input.bookId]
    )
    const balances = await this.readBalances(reader, input.bookId, input.asOf)
    const positions = await reader.query<PositionRow>(
      "SELECT id, investment_account_id, CAST(book_cost_minor AS TEXT) " +
        "AS book_cost_minor, status, allocation_revision " +
        "FROM investment_positions WHERE book_id = ?",
      [input.bookId]
    )
    const valuations = await reader.query<ValuationRow>(
      "SELECT id, position_id, allocation_revision, valued_at, valued_on, recorded_at, " +
        "record_sequence, CAST(gross_value_minor AS TEXT) AS gross_value_minor " +
        "FROM investment_valuations WHERE book_id = ? AND valued_on <= ?",
      [input.bookId, input.asOf]
    )

    const currentValuations = this.currentValuations(positions, valuations)
    const positionCosts = new Map<string, bigint>()
    let investmentMarketValue = 0n
    let valuedPositionCount = 0
    const valuationDays: string[] = []
    for (const position of positions) {
      if (readString(position.status, "position.status") !== "OPEN") continue
      const cost = readBigInt(position.book_cost_minor, "book_cost_minor")
      positionCosts.set(
        readString(position.investment_account_id, "investment_account_id"),
        (positionCosts.get(
          readString(position.investment_account_id, "investment_account_id")
        ) ?? 0n) + cost
      )
      const valuation = currentValuations.get(
        readString(position.id, "position.id")
      )
      investmentMarketValue += valuation?.value ?? cost
      if (valuation !== undefined) {
        valuedPositionCount += 1
        valuationDays.push(valuation.valuedOn)
      }
    }

    let available = 0n
    let otherAssets = 0n
    let archivedDaily = 0n
    let bookAssets = 0n
    let bookLiabilities = 0n
    let investmentLedger = 0n
    const warnings: InvestmentWarning[] = []
    const investmentIds = new Set<string>()
    for (const account of accounts) {
      const id = readString(account.id, "account.id")
      const kind = readAccountKind(account.kind)
      const status = readAccountStatus(account.status)
      const type =
        account.financial_type === null
          ? undefined
          : readString(account.financial_type, "financial_type")
      const balance = balances.get(id) ?? 0n
      const display = BigInt(toDisplayMinor(balance, kind))
      if (kind === "ASSET") bookAssets += display
      if (kind === "LIABILITY") bookLiabilities += display
      if (type === "BANK" || type === "PAYMENT_ACCOUNT" || type === "CASH") {
        if (status === "ACTIVE") available += display
        else archivedDaily += display
      }
      if (type === "OTHER_ASSET") otherAssets += display
      if (type === "INVESTMENT_ACCOUNT") {
        investmentIds.add(id)
        investmentLedger += display
      }
    }

    let positionCost = 0n
    for (const [accountId, cost] of positionCosts) {
      positionCost += cost
      const cash = (balances.get(accountId) ?? 0n) - cost
      if (cash < 0n) {
        warnings.push({
          code: "INVESTMENT_CASH_NEGATIVE",
          investmentAccountId: accountId,
          cashMinor: cash.toString(),
          currency: input.currency,
          asOf: input.asOf,
        })
      }
    }
    for (const accountId of investmentIds) {
      if (positionCosts.has(accountId)) continue
      const cash = balances.get(accountId) ?? 0n
      if (cash < 0n) {
        warnings.push({
          code: "INVESTMENT_CASH_NEGATIVE",
          investmentAccountId: accountId,
          cashMinor: cash.toString(),
          currency: input.currency,
          asOf: input.asOf,
        })
      }
    }

    const bookNetWorth = bookAssets - bookLiabilities
    const unrealized = investmentMarketValue - positionCost
    const dates = valuationDays.sort()
    return {
      bookId: input.bookId,
      currency: input.currency,
      asOf: input.asOf,
      availableMinor: available.toString(),
      otherAssetsMinor: otherAssets.toString(),
      archivedDailyAccountBalanceMinor: archivedDaily.toString(),
      bookNetWorthMinor: bookNetWorth.toString(),
      marketNetWorthMinor: (bookNetWorth + unrealized).toString(),
      investmentLedgerMinor: investmentLedger.toString(),
      positionCostMinor: positionCost.toString(),
      investmentCashMinor: (investmentLedger - positionCost).toString(),
      investmentMarketValueMinor: investmentMarketValue.toString(),
      unrealizedResultMinor: unrealized.toString(),
      openPositionCount: positions.filter(
        (position) => readString(position.status, "position.status") === "OPEN"
      ).length,
      valuedPositionCount,
      valuationDateRange:
        dates.length === 0
          ? null
          : { oldest: dates[0] as string, newest: dates.at(-1) as string },
      warnings: warnings.sort((left, right) =>
        left.investmentAccountId.localeCompare(right.investmentAccountId)
      ),
    }
  }

  private async readBalances(
    reader: SqliteReader,
    bookId: string,
    asOf: string
  ): Promise<Map<string, bigint>> {
    const balances = new Map<string, bigint>()
    let afterId = ""
    for (;;) {
      const rows = await reader.query<PostingRow>(
        "SELECT p.id AS posting_id, p.account_id, " +
          "CAST(p.amount_minor AS TEXT) AS amount_minor FROM postings p " +
          "JOIN journal_entries e ON e.id = p.journal_entry_id " +
          "AND e.book_id = p.book_id WHERE p.book_id = ? AND p.id > ? " +
          "AND e.occurred_on <= ? ORDER BY p.id ASC LIMIT ?",
        [bookId, afterId, asOf, String(PAGE_SIZE)]
      )
      for (const row of rows) {
        const id = readString(row.account_id, "account_id")
        balances.set(
          id,
          (balances.get(id) ?? 0n) +
            readBigInt(row.amount_minor, "amount_minor")
        )
      }
      if (rows.length < PAGE_SIZE) return balances
      afterId = readString(rows.at(-1)?.posting_id, "posting_id")
    }
  }

  private currentValuations(
    positions: readonly PositionRow[],
    valuations: readonly ValuationRow[]
  ): Map<string, { readonly value: bigint; readonly valuedOn: string }> {
    const revisions = new Map(
      positions.map((position) => [
        readString(position.id, "position.id"),
        readInteger(position.allocation_revision, "allocation_revision"),
      ])
    )
    const result = new Map<
      string,
      {
        readonly value: bigint
        readonly valuedOn: string
        readonly key: string
      }
    >()
    for (const valuation of valuations) {
      const positionId = readString(valuation.position_id, "position_id")
      if (
        revisions.get(positionId) !==
        readInteger(valuation.allocation_revision, "allocation_revision")
      )
        continue
      const key = `${readString(valuation.valued_at, "valued_at")}\u0000${readString(valuation.recorded_at, "recorded_at")}\u0000${String(readInteger(valuation.record_sequence, "record_sequence")).padStart(20, "0")}`
      const current = result.get(positionId)
      if (current === undefined || key > current.key) {
        result.set(positionId, {
          value: readBigInt(valuation.gross_value_minor, "gross_value_minor"),
          valuedOn: readString(valuation.valued_on, "valued_on"),
          key,
        })
      }
    }
    return new Map(
      [...result].map(([positionId, value]) => [
        positionId,
        { value: value.value, valuedOn: value.valuedOn },
      ])
    )
  }
}
