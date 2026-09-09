import {
  LocalDate,
  normalizeSearchText,
  type JournalEntryOrigin,
  type LedgerAccountId,
} from "@workspace/domain"
import type {
  GetJournalChainSummaryInput,
  JournalBusinessType,
  JournalChainCursorKey,
  JournalChainFilterCriteria,
  JournalChainStatus,
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
const JOURNAL_CHAIN_STATUSES = [
  "ACTIVE",
  "EDITED",
  "CANCELLED",
] as const satisfies readonly JournalChainStatus[]
const JOURNAL_CHAIN_CURSOR_PREFIX = "jc1"
const DEFAULT_JOURNAL_CHAIN_LIMIT = 20
const DECIMAL_PATTERN = /^(0|[1-9]\d*)$/

export interface JournalChainFilterQuery {
  readonly bookId: string
  readonly from?: string
  readonly to?: string
  readonly accountIds?: readonly string[]
  readonly categoryIds?: readonly string[]
  readonly types?: readonly string[]
  readonly origins?: readonly string[]
  readonly search?: string
}

export interface ListJournalChainsQuery extends JournalChainFilterQuery {
  readonly limit?: number
  readonly cursor?: string
}

export interface GetJournalChainSummaryQuery extends JournalChainFilterQuery {
  readonly status?: string
}

export type NormalizedJournalChainFilters = Omit<
  ListJournalChainsInput,
  "bookId"
>

export type NormalizedJournalChainCriteria = Omit<
  JournalChainFilterCriteria,
  "bookId"
>

export type NormalizedJournalChainSummaryFilters = Omit<
  GetJournalChainSummaryInput,
  "bookId"
>

export function normalizeJournalChainFilters(
  query: ListJournalChainsQuery
): NormalizedJournalChainFilters {
  const criteria = normalizeJournalChainCriteria(query)
  const limit = parseLimit(query.limit)
  const filterFingerprint = journalChainFilterFingerprint(criteria)
  const cursor =
    query.cursor === undefined
      ? undefined
      : decodeJournalChainCursor(query.cursor)
  if (cursor !== undefined && cursor.filterFingerprint !== filterFingerprint) {
    throw invalidQuery("cursor")
  }

  return {
    ...criteria,
    limit,
    ...(cursor === undefined ? {} : { cursor }),
  }
}

export function normalizeJournalChainSummaryFilters(
  query: GetJournalChainSummaryQuery
): NormalizedJournalChainSummaryFilters {
  const criteria = normalizeJournalChainCriteria(query)
  const status = parseStatus(query.status)
  return {
    ...criteria,
    ...(status === undefined ? {} : { status }),
  }
}

function normalizeJournalChainCriteria(
  query: JournalChainFilterQuery
): NormalizedJournalChainCriteria {
  const from = parseDate(query.from, "from")
  const to = parseDate(query.to, "to")
  if (from !== undefined && to !== undefined && from.compareTo(to) > 0) {
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

export function encodeJournalChainCursor(key: JournalChainCursorKey): string {
  validateCursorKey(key)
  return `${JOURNAL_CHAIN_CURSOR_PREFIX}.${encodeURIComponent(JSON.stringify(key))}`
}

export function decodeJournalChainCursor(
  value: unknown
): JournalChainCursorKey {
  if (
    typeof value !== "string" ||
    !value.startsWith(`${JOURNAL_CHAIN_CURSOR_PREFIX}.`)
  ) {
    throw invalidCursor()
  }

  const payload = value.slice(JOURNAL_CHAIN_CURSOR_PREFIX.length + 1)
  if (payload.length === 0) {
    throw invalidCursor()
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(decodeURIComponent(payload))
  } catch {
    throw invalidCursor()
  }

  if (!isRecord(decoded)) {
    throw invalidCursor()
  }

  const key: JournalChainCursorKey = {
    occurredOn: decoded.occurredOn as string,
    sequence: decoded.sequence as string,
    chainId: decoded.chainId as string,
    filterFingerprint: decoded.filterFingerprint as string,
  }
  validateCursorKey(key)
  return key
}

export function journalChainFilterFingerprint(
  filters: Omit<NormalizedJournalChainFilters, "limit" | "cursor">
): string {
  return fingerprint({
    from: filters.from?.value,
    to: filters.to?.value,
    accountIds: filters.accountIds,
    categoryIds: filters.categoryIds,
    types: filters.types,
    origins: filters.origins,
    search: filters.search,
  })
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

function parseStatus(value: unknown): JournalChainStatus | undefined {
  if (value === undefined) return undefined
  if (
    typeof value !== "string" ||
    !JOURNAL_CHAIN_STATUSES.includes(value as JournalChainStatus)
  ) {
    throw invalidQuery("status")
  }
  return value as JournalChainStatus
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_JOURNAL_CHAIN_LIMIT
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalidQuery("limit")
  }
  return limit
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  )
}

function fingerprint(filters: {
  readonly from?: string
  readonly to?: string
  readonly accountIds?: readonly string[]
  readonly categoryIds?: readonly string[]
  readonly types?: readonly string[]
  readonly origins?: readonly string[]
  readonly search?: string
}): string {
  return JSON.stringify({
    from: filters.from ?? null,
    to: filters.to ?? null,
    accountIds:
      filters.accountIds === undefined ? [] : uniqueSorted(filters.accountIds),
    categoryIds:
      filters.categoryIds === undefined
        ? []
        : uniqueSorted(filters.categoryIds),
    types: filters.types === undefined ? [] : uniqueSorted(filters.types),
    origins: filters.origins === undefined ? [] : uniqueSorted(filters.origins),
    search: filters.search ?? null,
  })
}

function validateCursorKey(key: JournalChainCursorKey): void {
  if (!isRecord(key)) {
    throw invalidCursor()
  }
  validateCursorDate(key.occurredOn)
  if (typeof key.sequence !== "string" || !DECIMAL_PATTERN.test(key.sequence)) {
    throw invalidQuery("cursor.sequence")
  }
  if (typeof key.chainId !== "string" || key.chainId.trim().length === 0) {
    throw invalidQuery("cursor.chainId")
  }
  if (
    typeof key.filterFingerprint !== "string" ||
    key.filterFingerprint.length === 0
  ) {
    throw invalidQuery("cursor.filterFingerprint")
  }
}

function validateCursorDate(value: unknown): void {
  if (typeof value !== "string") {
    throw invalidCursor()
  }
  try {
    LocalDate.parse(value)
  } catch {
    throw invalidQuery("cursor.occurredOn")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function invalidCursor() {
  return invalidQuery("cursor")
}
