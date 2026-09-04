import {
  LocalDate,
  normalizeSearchText,
  type JournalEntryOrigin,
  type LedgerAccountId,
} from "@workspace/domain"
import type {
  JournalBusinessType,
  ListJournalChainsInput,
} from "../ports/index.js"
import { invalidQuery } from "./query-validation.js"

const JOURNAL_CHAIN_TYPES = [
  "OPENING_BALANCE",
  "INCOME",
  "EXPENSE",
  "TRANSFER",
] as const satisfies readonly JournalBusinessType[]
const JOURNAL_CHAIN_ORIGINS = [
  "MANUAL",
  "SYSTEM",
] as const satisfies readonly JournalEntryOrigin[]

export interface ListJournalChainsQuery {
  readonly bookId: string
  readonly from?: string
  readonly to?: string
  readonly accountIds?: readonly string[]
  readonly categoryIds?: readonly string[]
  readonly types?: readonly string[]
  readonly origins?: readonly string[]
  readonly search?: string
}

export type NormalizedJournalChainFilters = Omit<
  ListJournalChainsInput,
  "bookId"
>

export function normalizeJournalChainFilters(
  query: ListJournalChainsQuery
): NormalizedJournalChainFilters {
  const from = parseDate(query.from, "from")
  const to = parseDate(query.to, "to")
  if (
    (from === undefined) !== (to === undefined) ||
    (from !== undefined && to !== undefined && from.compareTo(to) > 0)
  ) {
    throw invalidQuery("from/to")
  }

  const accountIds = parseIdList(query.accountIds, "accountIds")
  const categoryIds = parseIdList(query.categoryIds, "categoryIds")
  const types = parseEnumList(query.types, JOURNAL_CHAIN_TYPES, "types")
  const origins = parseEnumList(query.origins, JOURNAL_CHAIN_ORIGINS, "origins")
  const search = parseSearch(query.search)
  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(accountIds === undefined ? {} : { accountIds }),
    ...(categoryIds === undefined ? {} : { categoryIds }),
    ...(types === undefined ? {} : { types }),
    ...(origins === undefined ? {} : { origins }),
    ...(search === undefined ? {} : { search }),
  }
}

function parseDate(value: unknown, field: string): LocalDate | undefined {
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

function parseIdList(
  value: readonly string[] | undefined,
  field: string
): readonly LedgerAccountId[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length === 0) {
    throw invalidQuery(field)
  }

  return uniqueSorted(
    value.map((item) => {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw invalidQuery(field)
      }
      return item.trim() as LedgerAccountId
    })
  )
}

function parseEnumList<T extends string>(
  value: readonly string[] | undefined,
  allowed: readonly T[],
  field: string
): readonly T[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value.length === 0) {
    throw invalidQuery(field)
  }

  return uniqueSorted(
    value.map((item) => {
      if (typeof item !== "string" || !allowed.includes(item as T)) {
        throw invalidQuery(field)
      }
      return item as T
    })
  )
}

function parseSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== "string") {
    throw invalidQuery("search")
  }

  const normalized = normalizeSearchText(value)
  if (normalized.length === 0) {
    throw invalidQuery("search")
  }
  return normalized
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  )
}
