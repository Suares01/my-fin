import {
  ApplicationError,
  type BookScopedLookup,
  type InvestmentInstrumentRepository,
} from "@workspace/application"
import {
  INVESTMENT_INSTRUMENT_TYPES,
  INSTRUMENT_IDENTIFIER_SCHEMES,
  InvestmentInstrument,
  instrumentIdentifier,
  type InstrumentIdentifierSnapshot,
  type InvestmentInstrumentId,
  type InvestmentInstrumentSnapshot,
} from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"

type InstrumentRow = {
  readonly id: unknown
  readonly book_id: unknown
  readonly name: unknown
  readonly normalized_name: unknown
  readonly type: unknown
  readonly currency: unknown
  readonly issuer_name: unknown
  readonly status: unknown
  readonly version: unknown
}

type IdentifierRow = {
  readonly scheme: unknown
  readonly value: unknown
  readonly market: unknown
}

export class SqliteInvestmentInstrumentRepository implements InvestmentInstrumentRepository {
  public constructor(private readonly executor: SqliteExecutor) {}

  public async findById(
    bookId: string,
    id: InvestmentInstrumentId
  ): Promise<BookScopedLookup<InvestmentInstrument>> {
    const rows = await this.executor.query<InstrumentRow>(
      "SELECT id, book_id, name, normalized_name, type, currency, issuer_name, status, version " +
        "FROM investment_instruments WHERE id = ?",
      [id]
    )
    const row = rows[0]
    if (row === undefined) return { kind: "NOT_FOUND" }
    if (row.book_id !== bookId) return { kind: "BOOK_MISMATCH" }

    const identifiers = await this.identifiers(bookId, id)
    return {
      kind: "FOUND",
      value: InvestmentInstrument.restore({
        id: requiredString(row.id, "id") as InvestmentInstrumentId,
        bookId: requiredString(row.book_id, "book_id") as never,
        name: requiredString(row.name, "name"),
        normalizedName: requiredString(row.normalized_name, "normalized_name"),
        type: enumValue(row.type, INVESTMENT_INSTRUMENT_TYPES, "type"),
        currency: requiredString(row.currency, "currency"),
        ...(optionalString(row.issuer_name, "issuer_name") === undefined
          ? {}
          : { issuerName: optionalString(row.issuer_name, "issuer_name") }),
        identifiers,
        status: enumValue(
          row.status,
          ["ACTIVE", "ARCHIVED"] as const,
          "status"
        ),
        version: nonNegativeInteger(row.version, "version"),
      }),
    }
  }

  public async existsWithIdentifier(
    bookId: string,
    identifier: {
      readonly scheme: string
      readonly value: string
      readonly market?: string
    },
    excludeId?: InvestmentInstrumentId
  ): Promise<boolean> {
    const normalized = instrumentIdentifier(
      identifier as InstrumentIdentifierSnapshot
    )
    const rows = await this.executor.query<{ readonly present: number }>(
      "SELECT 1 AS present FROM investment_instrument_identifiers " +
        "WHERE book_id = ? AND scheme = ? AND normalized_value = ? AND market = ?" +
        (excludeId === undefined ? "" : " AND instrument_id <> ?") +
        " LIMIT 1",
      excludeId === undefined
        ? [bookId, normalized.scheme, normalized.value, normalized.market ?? ""]
        : [
            bookId,
            normalized.scheme,
            normalized.value,
            normalized.market ?? "",
            excludeId,
          ]
    )
    return rows.length > 0
  }

  public async add(value: InvestmentInstrument): Promise<void> {
    if (value.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new investment instrument must start at version zero"
      )
    }
    const snapshot = value.toSnapshot()
    try {
      await this.insertInstrument(snapshot)
      await this.replaceIdentifiers(snapshot)
    } catch (error) {
      throw mapSqliteError(error)
    }
  }

  public async save(
    value: InvestmentInstrument,
    expectedVersion: number
  ): Promise<void> {
    if (value.version !== expectedVersion + 1) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Investment instrument ${value.id} has a conflicting version`
      )
    }
    const snapshot = value.toSnapshot()
    let result
    try {
      result = await this.executor.execute(
        "UPDATE investment_instruments SET name = ?, normalized_name = ?, type = ?, " +
          "currency = ?, issuer_name = ?, status = ?, version = ? " +
          "WHERE id = ? AND book_id = ? AND version = ?",
        [
          snapshot.name,
          snapshot.normalizedName,
          snapshot.type,
          snapshot.currency,
          snapshot.issuerName ?? null,
          snapshot.status,
          snapshot.version,
          snapshot.id,
          snapshot.bookId,
          expectedVersion,
        ]
      )
      if (result.rowsAffected !== 0) await this.replaceIdentifiers(snapshot)
    } catch (error) {
      throw mapSqliteError(error)
    }
    if (result.rowsAffected === 0) {
      const lookup = await this.findById(snapshot.bookId, snapshot.id)
      if (lookup.kind === "NOT_FOUND") {
        throw new ApplicationError(
          "ENTITY_NOT_FOUND",
          `Investment instrument ${value.id} was not found`
        )
      }
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Investment instrument ${value.id} has a conflicting version`
      )
    }
  }

  private async insertInstrument(
    snapshot: InvestmentInstrumentSnapshot
  ): Promise<void> {
    await this.executor.execute(
      "INSERT INTO investment_instruments (id, book_id, name, normalized_name, type, currency, issuer_name, status, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        snapshot.id,
        snapshot.bookId,
        snapshot.name,
        snapshot.normalizedName,
        snapshot.type,
        snapshot.currency,
        snapshot.issuerName ?? null,
        snapshot.status,
        snapshot.version,
      ]
    )
  }

  private async replaceIdentifiers(
    snapshot: InvestmentInstrumentSnapshot
  ): Promise<void> {
    await this.executor.execute(
      "DELETE FROM investment_instrument_identifiers WHERE instrument_id = ? AND book_id = ?",
      [snapshot.id, snapshot.bookId]
    )
    for (const identifier of snapshot.identifiers) {
      await this.executor.execute(
        "INSERT INTO investment_instrument_identifiers (instrument_id, book_id, scheme, value, normalized_value, market) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
        [
          snapshot.id,
          snapshot.bookId,
          identifier.scheme,
          identifier.value,
          identifier.value,
          identifier.market ?? "",
        ]
      )
    }
  }

  private async identifiers(
    bookId: string,
    instrumentId: InvestmentInstrumentId
  ): Promise<readonly InstrumentIdentifierSnapshot[]> {
    const rows = await this.executor.query<IdentifierRow>(
      "SELECT scheme, value, market FROM investment_instrument_identifiers " +
        "WHERE book_id = ? AND instrument_id = ? " +
        "ORDER BY rowid",
      [bookId, instrumentId]
    )
    return rows.map((row) =>
      instrumentIdentifier({
        scheme: enumValue(
          row.scheme,
          INSTRUMENT_IDENTIFIER_SCHEMES,
          "identifier.scheme"
        ),
        value: requiredString(row.value, "identifier.value"),
        ...(stringValue(row.market, "identifier.market") === ""
          ? {}
          : { market: stringValue(row.market, "identifier.market") }),
      })
    )
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Invalid investment instrument ${field}`)
  }
  return value
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) return undefined
  return requiredString(value, field)
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid investment instrument ${field}`)
  }
  return value
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new TypeError(`Invalid investment instrument ${field}`)
  }
  return value as T
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Invalid investment instrument ${field}`)
  }
  return value
}
