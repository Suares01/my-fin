import {
  ApplicationError,
  type BookScopedLookup,
  type InvestmentPositionRepository,
} from "@workspace/application"
import {
  InvestmentPosition,
  type InvestmentInstrumentId,
  type InvestmentPositionId,
  type InvestmentPositionSnapshot,
  type LedgerAccountId,
} from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"
import { readInteger, readString } from "../queries/sqlite-query-values.js"

type PositionRow = {
  readonly id: unknown
  readonly book_id: unknown
  readonly investment_account_id: unknown
  readonly instrument_id: unknown
  readonly label: unknown
  readonly normalized_label: unknown
  readonly quantity_mode: unknown
  readonly quantity: unknown
  readonly book_cost_minor: unknown
  readonly currency: unknown
  readonly opened_on: unknown
  readonly closed_on: unknown
  readonly status: unknown
  readonly allocation_revision: unknown
  readonly allocation_effective_on: unknown
  readonly version: unknown
  readonly rate_kind: unknown
  readonly index_name: unknown
  readonly annual_rate: unknown
  readonly index_percentage: unknown
  readonly annual_spread_rate: unknown
  readonly issue_date: unknown
  readonly grace_period_date: unknown
  readonly maturity_date: unknown
}

const POSITION_SELECT =
  "SELECT p.id, p.book_id, p.investment_account_id, p.instrument_id, p.label, " +
  "p.normalized_label, p.quantity_mode, p.quantity, " +
  "CAST(p.book_cost_minor AS TEXT) AS book_cost_minor, p.currency, p.opened_on, " +
  "p.closed_on, p.status, p.allocation_revision, p.allocation_effective_on, " +
  "p.version, t.rate_kind, t.index_name, t.annual_rate, t.index_percentage, " +
  "t.annual_spread_rate, t.issue_date, t.grace_period_date, t.maturity_date " +
  "FROM investment_positions AS p LEFT JOIN investment_fixed_income_terms AS t " +
  "ON t.position_id = p.id AND t.book_id = p.book_id"

export class SqliteInvestmentPositionRepository implements InvestmentPositionRepository {
  public constructor(private readonly executor: SqliteExecutor) {}

  public async findById(
    bookId: string,
    id: InvestmentPositionId
  ): Promise<BookScopedLookup<InvestmentPosition>> {
    const rows = await this.executor.query<PositionRow>(
      POSITION_SELECT + " WHERE p.id = ?",
      [id]
    )
    const row = rows[0]
    if (row === undefined) return { kind: "NOT_FOUND" }
    if (row.book_id !== bookId) return { kind: "BOOK_MISMATCH" }
    return { kind: "FOUND", value: InvestmentPosition.restore(toSnapshot(row)) }
  }

  public async hasAnyForAccount(
    bookId: string,
    id: LedgerAccountId
  ): Promise<boolean> {
    return this.exists("investment_account_id = ?", [bookId, id])
  }

  public async hasAnyForInstrument(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<boolean> {
    return this.exists("instrument_id = ?", [bookId, id])
  }

  public async hasOpenForAccount(
    bookId: string,
    id: LedgerAccountId
  ): Promise<boolean> {
    return this.exists("investment_account_id = ? AND status = 'OPEN'", [
      bookId,
      id,
    ])
  }

  public async hasOpenForInstrument(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<boolean> {
    return this.exists("instrument_id = ? AND status = 'OPEN'", [bookId, id])
  }

  public async add(value: InvestmentPosition): Promise<void> {
    if (value.version !== 0) throw concurrent(value.id)
    const snapshot = value.toSnapshot()
    try {
      await this.insert(snapshot)
      await this.insertTerms(snapshot)
    } catch (error) {
      throw mapSqliteError(error)
    }
  }

  public async save(
    value: InvestmentPosition,
    expectedVersion: number
  ): Promise<void> {
    if (value.version !== expectedVersion + 1) throw concurrent(value.id)
    const snapshot = value.toSnapshot()
    const persisted = await this.findById(snapshot.bookId, snapshot.id)
    if (persisted.kind === "NOT_FOUND") throw missing(value.id)
    if (
      persisted.kind !== "FOUND" ||
      !sameImmutable(persisted.value.toSnapshot(), snapshot)
    ) {
      throw concurrent(value.id)
    }

    let result
    try {
      result = await this.executor.execute(
        "UPDATE investment_positions SET label = ?, normalized_label = ?, quantity = ?, " +
          "book_cost_minor = ?, opened_on = ?, closed_on = ?, status = ?, " +
          "allocation_revision = ?, allocation_effective_on = ?, version = ? " +
          "WHERE id = ? AND book_id = ? AND version = ?",
        [
          snapshot.label ?? null,
          snapshot.normalizedLabel,
          snapshot.quantity ?? null,
          snapshot.bookCostMinor,
          snapshot.openedOn,
          snapshot.closedOn ?? null,
          snapshot.status,
          snapshot.allocationRevision,
          snapshot.allocationEffectiveOn,
          snapshot.version,
          snapshot.id,
          snapshot.bookId,
          expectedVersion,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }
    if (result.rowsAffected === 0) throw concurrent(value.id)
  }

  private async exists(
    predicate: string,
    parameters: readonly (string | number)[]
  ): Promise<boolean> {
    const rows = await this.executor.query<{ readonly present: number }>(
      "SELECT 1 AS present FROM investment_positions WHERE book_id = ? AND " +
        predicate +
        " LIMIT 1",
      parameters
    )
    return rows.length > 0
  }

  private async insert(snapshot: InvestmentPositionSnapshot): Promise<void> {
    await this.executor.execute(
      "INSERT INTO investment_positions (id, book_id, investment_account_id, instrument_id, " +
        "label, normalized_label, quantity_mode, quantity, book_cost_minor, currency, " +
        "opened_on, closed_on, status, allocation_revision, allocation_effective_on, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        snapshot.id,
        snapshot.bookId,
        snapshot.investmentAccountId,
        snapshot.instrumentId,
        snapshot.label ?? null,
        snapshot.normalizedLabel,
        snapshot.quantityMode,
        snapshot.quantity ?? null,
        snapshot.bookCostMinor,
        snapshot.currency,
        snapshot.openedOn,
        snapshot.closedOn ?? null,
        snapshot.status,
        snapshot.allocationRevision,
        snapshot.allocationEffectiveOn,
        snapshot.version,
      ]
    )
  }

  private async insertTerms(
    snapshot: InvestmentPositionSnapshot
  ): Promise<void> {
    const terms = snapshot.fixedIncomeTerms
    if (terms === undefined) return
    await this.executor.execute(
      "INSERT INTO investment_fixed_income_terms (position_id, book_id, rate_kind, index_name, " +
        "annual_rate, index_percentage, annual_spread_rate, issue_date, maturity_date, grace_period_date) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        snapshot.id,
        snapshot.bookId,
        terms.rateKind ?? null,
        terms.index ?? null,
        terms.annualRate ?? null,
        terms.indexPercentage ?? null,
        terms.annualSpreadRate ?? null,
        terms.issueDate ?? null,
        terms.maturityDate ?? null,
        terms.gracePeriodDate ?? null,
      ]
    )
  }
}

function toSnapshot(row: PositionRow): InvestmentPositionSnapshot {
  const rateKind = optionalEnum(
    row.rate_kind,
    ["PREFIXED", "INDEXED", "HYBRID"] as const,
    "rate_kind"
  )
  return {
    id: readString(row.id, "id") as InvestmentPositionId,
    bookId: readString(row.book_id, "book_id") as never,
    investmentAccountId: readString(
      row.investment_account_id,
      "investment_account_id"
    ) as LedgerAccountId,
    instrumentId: readString(
      row.instrument_id,
      "instrument_id"
    ) as InvestmentInstrumentId,
    ...(optionalString(row.label, "label") === undefined
      ? {}
      : { label: optionalString(row.label, "label") }),
    normalizedLabel: readString(row.normalized_label, "normalized_label"),
    quantityMode: enumValue(
      row.quantity_mode,
      ["UNITS", "AMOUNT"] as const,
      "quantity_mode"
    ),
    ...(optionalString(row.quantity, "quantity") === undefined
      ? {}
      : { quantity: optionalString(row.quantity, "quantity") }),
    bookCostMinor: readString(row.book_cost_minor, "book_cost_minor"),
    currency: readString(row.currency, "currency"),
    openedOn: readString(row.opened_on, "opened_on"),
    ...(optionalString(row.closed_on, "closed_on") === undefined
      ? {}
      : { closedOn: optionalString(row.closed_on, "closed_on") }),
    status: enumValue(row.status, ["OPEN", "CLOSED"] as const, "status"),
    ...(rateKind === undefined
      ? {}
      : {
          fixedIncomeTerms: {
            rateKind,
            ...(optionalEnum(
              row.index_name,
              ["CDI", "SELIC", "IPCA", "IGPM", "OTHER"] as const,
              "index_name"
            ) === undefined
              ? {}
              : {
                  index: optionalEnum(
                    row.index_name,
                    ["CDI", "SELIC", "IPCA", "IGPM", "OTHER"] as const,
                    "index_name"
                  ),
                }),
            ...(optionalString(row.annual_rate, "annual_rate") === undefined
              ? {}
              : { annualRate: optionalString(row.annual_rate, "annual_rate") }),
            ...(optionalString(row.index_percentage, "index_percentage") ===
            undefined
              ? {}
              : {
                  indexPercentage: optionalString(
                    row.index_percentage,
                    "index_percentage"
                  ),
                }),
            ...(optionalString(row.annual_spread_rate, "annual_spread_rate") ===
            undefined
              ? {}
              : {
                  annualSpreadRate: optionalString(
                    row.annual_spread_rate,
                    "annual_spread_rate"
                  ),
                }),
            ...(optionalString(row.issue_date, "issue_date") === undefined
              ? {}
              : { issueDate: optionalString(row.issue_date, "issue_date") }),
            ...(optionalString(row.grace_period_date, "grace_period_date") ===
            undefined
              ? {}
              : {
                  gracePeriodDate: optionalString(
                    row.grace_period_date,
                    "grace_period_date"
                  ),
                }),
            ...(optionalString(row.maturity_date, "maturity_date") === undefined
              ? {}
              : {
                  maturityDate: optionalString(
                    row.maturity_date,
                    "maturity_date"
                  ),
                }),
          },
        }),
    allocationRevision: readInteger(
      row.allocation_revision,
      "allocation_revision"
    ),
    allocationEffectiveOn: readString(
      row.allocation_effective_on,
      "allocation_effective_on"
    ),
    version: readInteger(row.version, "version"),
  }
}

function sameImmutable(
  persisted: InvestmentPositionSnapshot,
  candidate: InvestmentPositionSnapshot
): boolean {
  return (
    persisted.bookId === candidate.bookId &&
    persisted.investmentAccountId === candidate.investmentAccountId &&
    persisted.instrumentId === candidate.instrumentId &&
    persisted.quantityMode === candidate.quantityMode &&
    persisted.currency === candidate.currency &&
    JSON.stringify(persisted.fixedIncomeTerms) ===
      JSON.stringify(candidate.fixedIncomeTerms)
  )
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined
  return readString(value, field)
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new TypeError(`Invalid investment position ${field}`)
  }
  return value as T
}

function optionalEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T | undefined {
  if (value === null || value === undefined) return undefined
  return enumValue(value, values, field)
}

function concurrent(id: string): ApplicationError {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    `Investment position ${id} has a conflicting version`
  )
}

function missing(id: string): ApplicationError {
  return new ApplicationError(
    "ENTITY_NOT_FOUND",
    `Investment position ${id} was not found`
  )
}
