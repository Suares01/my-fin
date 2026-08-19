import {
  LocalDate,
  type JournalEntryOrigin,
  type LedgerAccountKind,
} from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type { YearMonth } from "../ports/querying-types.js"

const JOURNAL_ENTRY_ORIGINS = [
  "MANUAL",
  "SYSTEM",
] as const satisfies readonly JournalEntryOrigin[]
const LEDGER_ACCOUNT_KINDS = [
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "EQUITY",
] as const satisfies readonly LedgerAccountKind[]

export function parseRequiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidQuery(field)
  }

  return value
}

export function parseOptionalDate(
  value: unknown,
  field: string
): LocalDate | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "string") {
    throw invalidQuery(field)
  }

  try {
    return LocalDate.parse(value)
  } catch {
    throw invalidQuery(field)
  }
}

export function parseDateRange(
  from: unknown,
  to: unknown
): { readonly from?: LocalDate; readonly to?: LocalDate } {
  const parsedFrom = parseOptionalDate(from, "from")
  const parsedTo = parseOptionalDate(to, "to")
  if (
    parsedFrom !== undefined &&
    parsedTo !== undefined &&
    parsedFrom.compareTo(parsedTo) > 0
  ) {
    throw invalidQuery("from/to")
  }

  return {
    ...(parsedFrom === undefined ? {} : { from: parsedFrom }),
    ...(parsedTo === undefined ? {} : { to: parsedTo }),
  }
}

export function parseMonth(value: unknown, field: string): YearMonth {
  if (
    typeof value !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ||
    value.startsWith("0000")
  ) {
    throw invalidQuery(field)
  }

  return value as YearMonth
}

export function parseMonthRange(
  fromMonth: unknown,
  toMonth: unknown
): { readonly fromMonth: YearMonth; readonly toMonth: YearMonth } {
  const from = parseMonth(fromMonth, "fromMonth")
  const to = parseMonth(toMonth, "toMonth")
  if (from > to) {
    throw invalidQuery("fromMonth/toMonth")
  }

  return { fromMonth: from, toMonth: to }
}

export function parseLimit(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    throw invalidQuery("limit")
  }

  return value
}

export function parseIdList(
  value: unknown,
  field: string
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw invalidQuery(field)
  }

  const ids = value.map((item) => parseRequiredId(item, field))
  return ids
}

export function parseEnumList<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  options?: { readonly allowEmpty?: boolean }
): readonly T[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (
    !Array.isArray(value) ||
    (value.length === 0 && options?.allowEmpty !== true)
  ) {
    throw invalidQuery(field)
  }

  const values = value.map((item) => {
    if (typeof item !== "string" || !allowed.includes(item as T)) {
      throw invalidQuery(field)
    }

    return item as T
  })
  return values
}

export function parseAccountKinds(
  value: unknown
): readonly LedgerAccountKind[] | undefined {
  return parseEnumList(value, LEDGER_ACCOUNT_KINDS, "accountKinds", {
    allowEmpty: true,
  })
}

export function parseJournalOrigins(
  value: unknown
): readonly JournalEntryOrigin[] | undefined {
  return parseEnumList(value, JOURNAL_ENTRY_ORIGINS, "origins")
}

export function parseSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "string") {
    throw invalidQuery("search")
  }

  const search = value.trim()
  if (search.length === 0) {
    throw invalidQuery("search")
  }

  return search
}

export function invalidQuery(field: string): ApplicationError {
  return new ApplicationError(
    "INVALID_QUERY",
    `Invalid financial query field: ${field}`
  )
}
