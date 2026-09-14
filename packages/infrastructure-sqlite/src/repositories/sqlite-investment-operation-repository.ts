import {
  ApplicationError,
  type BookScopedLookup,
  type InvestmentOperationRepository,
} from "@workspace/application"
import {
  InvestmentOperation,
  type InvestmentOperationId,
  type InvestmentOperationSnapshot,
  type InvestmentPositionId,
  type JournalEntryId,
} from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"
import { readInteger, readString } from "../queries/sqlite-query-values.js"

type OperationRow = Record<string, unknown>

const SELECT =
  "SELECT id, book_id, position_id, type, role, occurred_on, settled_on, recorded_at, " +
  "CAST(sequence AS TEXT) AS sequence, description, currency, quantity_delta, " +
  "CAST(book_cost_delta_minor AS TEXT) AS book_cost_delta_minor, " +
  "CAST(gross_amount_minor AS TEXT) AS gross_amount_minor, CAST(fees_minor AS TEXT) AS fees_minor, " +
  "CAST(taxes_minor AS TEXT) AS taxes_minor, CAST(net_cash_flow_minor AS TEXT) AS net_cash_flow_minor, " +
  "cash_mode, settlement_account_id, gain_category_id, loss_category_id, income_category_id, " +
  "fee_category_id, tax_category_id, before_kind, before_quantity, " +
  "CAST(before_book_cost_minor AS TEXT) AS before_book_cost_minor, before_status, before_opened_on, " +
  "before_closed_on, before_allocation_effective_on, journal_entry_id, reversal_of_id, reversed_by_id, " +
  "replacement_of_id, replaced_by_id, version FROM investment_operations"

export class SqliteInvestmentOperationRepository implements InvestmentOperationRepository {
  public constructor(private readonly executor: SqliteExecutor) {}

  public async findById(
    bookId: string,
    id: InvestmentOperationId
  ): Promise<BookScopedLookup<InvestmentOperation>> {
    const row = (
      await this.executor.query<OperationRow>(SELECT + " WHERE id = ?", [id])
    )[0]
    if (row === undefined) return { kind: "NOT_FOUND" }
    if (row.book_id !== bookId) return { kind: "BOOK_MISMATCH" }
    return { kind: "FOUND", value: InvestmentOperation.restore(snapshot(row)) }
  }

  public async findLastEffective(
    bookId: string,
    positionId: InvestmentPositionId,
    excludeOperationId?: InvestmentOperationId
  ): Promise<InvestmentOperation | null> {
    const rows = await this.executor.query<OperationRow>(
      SELECT +
        " WHERE book_id = ? AND position_id = ? AND role = 'BUSINESS' " +
        "AND reversed_by_id IS NULL AND replaced_by_id IS NULL" +
        (excludeOperationId === undefined ? "" : " AND id <> ?") +
        " ORDER BY occurred_on DESC, sequence DESC LIMIT 1",
      excludeOperationId === undefined
        ? [bookId, positionId]
        : [bookId, positionId, excludeOperationId]
    )
    const row = rows[0]
    return row === undefined ? null : InvestmentOperation.restore(snapshot(row))
  }

  public async findOwnerOfJournal(
    bookId: string,
    id: JournalEntryId
  ): Promise<InvestmentOperation | null> {
    const row = (
      await this.executor.query<OperationRow>(
        SELECT + " WHERE book_id = ? AND journal_entry_id = ?",
        [bookId, id]
      )
    )[0]
    return row === undefined ? null : InvestmentOperation.restore(snapshot(row))
  }

  public async add(value: InvestmentOperation): Promise<void> {
    if (value.version !== 0) throw concurrent(value.id)
    const valueSnapshot = value.toSnapshot()
    try {
      await this.executor.execute(
        "INSERT INTO investment_operations (id, book_id, position_id, type, role, occurred_on, settled_on, " +
          "recorded_at, sequence, description, currency, quantity_delta, book_cost_delta_minor, " +
          "gross_amount_minor, fees_minor, taxes_minor, net_cash_flow_minor, cash_mode, settlement_account_id, " +
          "gain_category_id, loss_category_id, income_category_id, fee_category_id, tax_category_id, before_kind, " +
          "before_quantity, before_book_cost_minor, before_status, before_opened_on, before_closed_on, " +
          "before_allocation_effective_on, journal_entry_id, reversal_of_id, reversed_by_id, replacement_of_id, " +
          "replaced_by_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        values(valueSnapshot)
      )
    } catch (error) {
      throw mapSqliteError(error)
    }
  }

  public async saveLineage(
    value: InvestmentOperation,
    expectedVersion: number
  ): Promise<void> {
    if (value.version !== expectedVersion + 1) throw concurrent(value.id)
    const item = value.toSnapshot()
    let result
    try {
      result = await this.executor.execute(
        "UPDATE investment_operations SET reversed_by_id = ?, replaced_by_id = ?, version = ? " +
          "WHERE id = ? AND book_id = ? AND position_id = ? AND version = ?",
        [
          item.reversedBy ?? null,
          item.replacedBy ?? null,
          item.version,
          item.id,
          item.bookId,
          item.positionId,
          expectedVersion,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }
    if (result.rowsAffected === 0) {
      const found = await this.findById(item.bookId, item.id)
      if (found.kind === "NOT_FOUND") throw missing(item.id)
      throw concurrent(item.id)
    }
  }
}

function values(
  item: InvestmentOperationSnapshot
): readonly (string | number | null)[] {
  const before = item.positionBefore
  return [
    item.id,
    item.bookId,
    item.positionId,
    item.type,
    item.role,
    item.occurredOn,
    item.settledOn ?? null,
    item.recordedAt,
    item.sequence,
    item.description,
    item.currency,
    item.quantityDelta ?? null,
    item.bookCostDeltaMinor,
    item.grossAmountMinor,
    item.feesMinor,
    item.taxesMinor,
    item.netCashFlowMinor,
    item.cashMode,
    item.settlementAccountId ?? null,
    item.categories.gainCategoryId ?? null,
    item.categories.lossCategoryId ?? null,
    item.categories.incomeCategoryId ?? null,
    item.categories.feeCategoryId ?? null,
    item.categories.taxCategoryId ?? null,
    before.kind,
    before.kind === "EXISTING" ? (before.quantity ?? null) : null,
    before.kind === "EXISTING" ? before.bookCostMinor : null,
    before.kind === "EXISTING" ? before.status : null,
    before.kind === "EXISTING" ? before.openedOn : null,
    before.kind === "EXISTING" ? (before.closedOn ?? null) : null,
    before.kind === "EXISTING" ? before.allocationEffectiveOn : null,
    item.journalEntryId ?? null,
    item.reversalOf ?? null,
    item.reversedBy ?? null,
    item.replacementOf ?? null,
    item.replacedBy ?? null,
    item.version,
  ]
}

function snapshot(row: OperationRow): InvestmentOperationSnapshot {
  const beforeKind = enumValue(
    row.before_kind,
    ["UNOPENED", "EXISTING"] as const,
    "before_kind"
  )
  return {
    id: required(row.id, "id") as InvestmentOperationId,
    bookId: required(row.book_id, "book_id") as never,
    positionId: required(
      row.position_id,
      "position_id"
    ) as InvestmentPositionId,
    type: enumValue(
      row.type,
      [
        "OPENING_ALLOCATION",
        "APPLICATION",
        "PURCHASE",
        "SALE",
        "REDEMPTION",
        "INCOME",
        "AMORTIZATION",
        "FEE",
        "TAX",
      ] as const,
      "type"
    ),
    role: enumValue(row.role, ["BUSINESS", "REVERSAL"] as const, "role"),
    occurredOn: required(row.occurred_on, "occurred_on"),
    ...optional(row.settled_on, "settled_on", "settledOn"),
    recordedAt: required(row.recorded_at, "recorded_at"),
    sequence: required(row.sequence, "sequence"),
    description: required(row.description, "description"),
    currency: required(row.currency, "currency"),
    ...optional(row.quantity_delta, "quantity_delta", "quantityDelta"),
    bookCostDeltaMinor: required(
      row.book_cost_delta_minor,
      "book_cost_delta_minor"
    ),
    grossAmountMinor: required(row.gross_amount_minor, "gross_amount_minor"),
    feesMinor: required(row.fees_minor, "fees_minor"),
    taxesMinor: required(row.taxes_minor, "taxes_minor"),
    netCashFlowMinor: required(row.net_cash_flow_minor, "net_cash_flow_minor"),
    cashMode: enumValue(
      row.cash_mode,
      ["NONE", "INTERNAL_CASH", "EXTERNAL_ACCOUNT"] as const,
      "cash_mode"
    ),
    ...optional(
      row.settlement_account_id,
      "settlement_account_id",
      "settlementAccountId"
    ),
    categories: {
      ...optional(row.gain_category_id, "gain_category_id", "gainCategoryId"),
      ...optional(row.loss_category_id, "loss_category_id", "lossCategoryId"),
      ...optional(
        row.income_category_id,
        "income_category_id",
        "incomeCategoryId"
      ),
      ...optional(row.fee_category_id, "fee_category_id", "feeCategoryId"),
      ...optional(row.tax_category_id, "tax_category_id", "taxCategoryId"),
    },
    positionBefore:
      beforeKind === "UNOPENED"
        ? { kind: "UNOPENED" }
        : {
            kind: "EXISTING",
            ...optional(row.before_quantity, "before_quantity", "quantity"),
            bookCostMinor: required(
              row.before_book_cost_minor,
              "before_book_cost_minor"
            ),
            status: enumValue(
              row.before_status,
              ["OPEN", "CLOSED"] as const,
              "before_status"
            ),
            openedOn: required(row.before_opened_on, "before_opened_on"),
            ...optional(row.before_closed_on, "before_closed_on", "closedOn"),
            allocationEffectiveOn: required(
              row.before_allocation_effective_on,
              "before_allocation_effective_on"
            ),
          },
    ...optional(row.journal_entry_id, "journal_entry_id", "journalEntryId"),
    ...optional(row.reversal_of_id, "reversal_of_id", "reversalOf"),
    ...optional(row.reversed_by_id, "reversed_by_id", "reversedBy"),
    ...optional(row.replacement_of_id, "replacement_of_id", "replacementOf"),
    ...optional(row.replaced_by_id, "replaced_by_id", "replacedBy"),
    version: readInteger(row.version, "version"),
  } as InvestmentOperationSnapshot
}

function required(value: unknown, field: string): string {
  return readString(value, field)
}
function optional<Key extends string>(
  value: unknown,
  field: string,
  key: Key
): Record<never, never> | { readonly [K in Key]: string } {
  return value === null || value === undefined
    ? {}
    : ({ [key]: required(value, field) } as { readonly [K in Key]: string })
}
function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !values.includes(value as T))
    throw new TypeError(`Invalid investment operation ${field}`)
  return value as T
}
function concurrent(id: string): ApplicationError {
  return new ApplicationError(
    "OPTIMISTIC_CONCURRENCY_FAILURE",
    `Investment operation ${id} has a conflicting version`
  )
}
function missing(id: string): ApplicationError {
  return new ApplicationError(
    "ENTITY_NOT_FOUND",
    `Investment operation ${id} was not found`
  )
}
