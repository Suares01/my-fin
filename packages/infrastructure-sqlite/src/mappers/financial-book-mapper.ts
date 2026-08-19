import { FinancialBook, type FinancialBookSnapshot } from "@workspace/domain"
import { readInteger } from "../queries/sqlite-query-values.js"

export type FinancialBookRow = {
  readonly id: unknown
  readonly name: unknown
  readonly base_currency: unknown
  readonly timezone: unknown
  readonly version: unknown
}

export type FinancialBookPersistence = {
  readonly id: string
  readonly name: string
  readonly base_currency: string
  readonly timezone: string
  readonly version: number
}

export const FinancialBookMapper = {
  toDomain(row: FinancialBookRow): FinancialBook {
    const snapshot: FinancialBookSnapshot = {
      id: readNonEmptyString(row.id, "id") as FinancialBookSnapshot["id"],
      name: readNonEmptyString(row.name, "name"),
      baseCurrency: readCurrency(row.base_currency),
      timezone: readNonEmptyString(row.timezone, "timezone"),
      version: readVersion(row.version),
    }

    return FinancialBook.restore(snapshot)
  },

  toPersistence(book: FinancialBook): FinancialBookPersistence {
    const snapshot = book.toSnapshot()
    return {
      id: snapshot.id,
      name: snapshot.name,
      base_currency: snapshot.baseCurrency,
      timezone: snapshot.timezone,
      version: snapshot.version,
    }
  },
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Invalid financial_books.${field}`)
  }

  return value
}

function readCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    throw new TypeError("Invalid financial_books.base_currency")
  }

  return value
}

function readVersion(value: unknown): number {
  try {
    const version = readInteger(value, "financial_books.version")
    if (version < 0) {
      throw new Error("negative version")
    }

    return version
  } catch {
    throw new TypeError("Invalid financial_books.version")
  }
}
