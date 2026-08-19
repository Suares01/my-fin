import {
  JournalEntry,
  normalizeSearchText,
  type JournalEntryOrigin,
  type JournalEntrySnapshot,
  type PostingSnapshot,
} from "@workspace/domain"
import { assertSqliteIntegerRange } from "../database/sqlite-error.js"
import { readInteger } from "../queries/sqlite-query-values.js"

export type JournalEntryRow = {
  readonly id: unknown
  readonly book_id: unknown
  readonly occurred_on: unknown
  readonly recorded_at: unknown
  readonly sequence: unknown
  readonly description: unknown
  readonly currency: unknown
  readonly origin: unknown
  readonly reversal_of_id: unknown
  readonly reversed_by_id: unknown
  readonly replacement_of_id: unknown
  readonly replaced_by_id: unknown
  readonly search_text: unknown
  readonly search_version: unknown
  readonly version: unknown
  readonly posting_id: unknown
  readonly posting_book_id: unknown
  readonly posting_journal_entry_id: unknown
  readonly posting_account_id: unknown
  readonly posting_position: unknown
  readonly posting_amount_minor: unknown
  readonly posting_currency: unknown
}

export type JournalEntryPersistence = {
  readonly entry: {
    readonly id: string
    readonly book_id: string
    readonly occurred_on: string
    readonly recorded_at: string
    readonly sequence: string
    readonly description: string
    readonly currency: string
    readonly origin: JournalEntryOrigin
    readonly reversal_of_id: string | null
    readonly reversed_by_id: string | null
    readonly replacement_of_id: string | null
    readonly replaced_by_id: string | null
    readonly search_text: string
    readonly search_version: number
    readonly version: number
  }
  readonly postings: readonly {
    readonly id: string
    readonly book_id: string
    readonly journal_entry_id: string
    readonly account_id: string
    readonly position: number
    readonly amount_minor: string
    readonly currency: string
  }[]
}

const ENTRY_ORIGINS = ["MANUAL", "SYSTEM"] as const

export const JournalEntryMapper = {
  toDomain(rows: readonly JournalEntryRow[]): JournalEntry {
    if (rows.length === 0) {
      throw new TypeError("Cannot restore a journal entry without postings")
    }

    const firstRow = rows[0]
    if (firstRow === undefined) {
      throw new TypeError("Cannot restore a journal entry without postings")
    }

    const first = readEntryValues(firstRow)
    const postings: PostingSnapshot[] = []
    const positions = new Set<number>()

    for (const row of rows) {
      const entry = readEntryValues(row)
      if (!sameEntry(entry, first)) {
        throw new TypeError("Inconsistent journal_entries rows")
      }

      const posting = readPosting(row, first)
      if (positions.has(posting.position)) {
        throw new TypeError("Duplicate journal posting position")
      }
      positions.add(posting.position)
      postings.push({
        id: posting.id as PostingSnapshot["id"],
        accountId: posting.accountId as PostingSnapshot["accountId"],
        amountMinor: posting.amountMinor,
        currency: posting.currency,
      })
    }

    const { reversalOf, reversedBy, replacementOf, replacedBy } = first
    const entryValues = {
      id: first.id,
      bookId: first.bookId,
      occurredOn: first.occurredOn,
      recordedAt: first.recordedAt,
      sequence: first.sequence,
      description: first.description,
      currency: first.currency,
      origin: first.origin,
      version: first.version,
    }
    const snapshot: JournalEntrySnapshot = {
      ...entryValues,
      id: first.id as JournalEntrySnapshot["id"],
      bookId: first.bookId as JournalEntrySnapshot["bookId"],
      postings,
      ...(reversalOf === null
        ? {}
        : { reversalOf: reversalOf as JournalEntrySnapshot["reversalOf"] }),
      ...(reversedBy === null
        ? {}
        : { reversedBy: reversedBy as JournalEntrySnapshot["reversedBy"] }),
      ...(replacementOf === null
        ? {}
        : {
            replacementOf:
              replacementOf as JournalEntrySnapshot["replacementOf"],
          }),
      ...(replacedBy === null
        ? {}
        : { replacedBy: replacedBy as JournalEntrySnapshot["replacedBy"] }),
    }

    return JournalEntry.restore(snapshot)
  },

  toPersistence(entry: JournalEntry): JournalEntryPersistence {
    const snapshot = entry.toSnapshot()
    const postings = snapshot.postings.map((posting, position) => {
      assertSqliteIntegerRange(posting.amountMinor, "amountMinor")
      return {
        id: posting.id,
        book_id: snapshot.bookId,
        journal_entry_id: snapshot.id,
        account_id: posting.accountId,
        position,
        amount_minor: posting.amountMinor.toString(),
        currency: posting.currency,
      }
    })

    return {
      entry: {
        id: snapshot.id,
        book_id: snapshot.bookId,
        occurred_on: snapshot.occurredOn,
        recorded_at: snapshot.recordedAt,
        sequence: snapshot.sequence,
        description: snapshot.description,
        currency: snapshot.currency,
        origin: snapshot.origin,
        reversal_of_id: snapshot.reversalOf ?? null,
        reversed_by_id: snapshot.reversedBy ?? null,
        replacement_of_id: snapshot.replacementOf ?? null,
        replaced_by_id: snapshot.replacedBy ?? null,
        search_text: normalizeSearchText(snapshot.description),
        search_version: 1,
        version: snapshot.version,
      },
      postings,
    }
  },
}

type EntryValues = {
  readonly id: string
  readonly bookId: string
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly currency: string
  readonly origin: JournalEntryOrigin
  readonly reversalOf: string | null
  readonly reversedBy: string | null
  readonly replacementOf: string | null
  readonly replacedBy: string | null
  readonly searchText: string
  readonly searchVersion: number
  readonly version: number
}

type PostingValues = {
  readonly id: string
  readonly accountId: string
  readonly position: number
  readonly amountMinor: bigint
  readonly currency: string
}

function readEntryValues(row: JournalEntryRow): EntryValues {
  return {
    id: readNonEmptyString(row.id, "id"),
    bookId: readNonEmptyString(row.book_id, "book_id"),
    occurredOn: readNonEmptyString(row.occurred_on, "occurred_on"),
    recordedAt: readNonEmptyString(row.recorded_at, "recorded_at"),
    sequence: readSequence(row.sequence),
    description: readString(row.description, "description"),
    currency: readCurrency(row.currency, "currency"),
    origin: readEnum(row.origin, ENTRY_ORIGINS, "origin"),
    reversalOf: readNullableString(row.reversal_of_id, "reversal_of_id"),
    reversedBy: readNullableString(row.reversed_by_id, "reversed_by_id"),
    replacementOf: readNullableString(
      row.replacement_of_id,
      "replacement_of_id"
    ),
    replacedBy: readNullableString(row.replaced_by_id, "replaced_by_id"),
    searchText: readString(row.search_text, "search_text"),
    searchVersion: readSearchVersion(row.search_version),
    version: readVersion(row.version),
  }
}

function readPosting(row: JournalEntryRow, entry: EntryValues): PostingValues {
  const postingBookId = readNonEmptyString(
    row.posting_book_id,
    "posting_book_id"
  )
  const journalEntryId = readNonEmptyString(
    row.posting_journal_entry_id,
    "posting_journal_entry_id"
  )
  if (postingBookId !== entry.bookId || journalEntryId !== entry.id) {
    throw new TypeError("Inconsistent posting relationship")
  }

  return {
    id: readNonEmptyString(row.posting_id, "posting_id"),
    accountId: readNonEmptyString(row.posting_account_id, "posting_account_id"),
    position: readPosition(row.posting_position),
    amountMinor: readAmount(row.posting_amount_minor),
    currency: readCurrency(row.posting_currency, "posting_currency"),
  }
}

function sameEntry(left: EntryValues, right: EntryValues): boolean {
  return (
    left.id === right.id &&
    left.bookId === right.bookId &&
    left.occurredOn === right.occurredOn &&
    left.recordedAt === right.recordedAt &&
    left.sequence === right.sequence &&
    left.description === right.description &&
    left.currency === right.currency &&
    left.origin === right.origin &&
    left.reversalOf === right.reversalOf &&
    left.reversedBy === right.reversedBy &&
    left.replacementOf === right.replacementOf &&
    left.replacedBy === right.replacedBy &&
    left.searchText === right.searchText &&
    left.searchVersion === right.searchVersion &&
    left.version === right.version
  )
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Invalid journal row ${field}`)
  }

  return value
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid journal row ${field}`)
  }

  return value
}

function readNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return readNonEmptyString(value, field)
}

function readCurrency(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    throw new TypeError(`Invalid journal row ${field}`)
  }

  return value
}

function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new TypeError(`Invalid journal row ${field}`)
  }

  return value as T
}

function readVersion(value: unknown): number {
  try {
    const version = readInteger(value, "journal row version")
    if (version < 0) {
      throw new Error("negative version")
    }

    return version
  } catch {
    throw new TypeError("Invalid journal row version")
  }
}

function readSearchVersion(value: unknown): number {
  try {
    const version = readInteger(value, "journal row search_version")
    if (version < 0) {
      throw new Error("negative search version")
    }

    return version
  } catch {
    throw new TypeError("Invalid journal row search_version")
  }
}

function readPosition(value: unknown): number {
  try {
    const position = readInteger(value, "journal row posting position")
    if (position < 0) {
      throw new Error("negative position")
    }

    return position
  } catch {
    throw new TypeError("Invalid journal row posting position")
  }
}

function readSequence(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new TypeError("Invalid journal row sequence")
  }

  return value
}

function readAmount(value: unknown): bigint {
  let amount: bigint
  if (typeof value === "string" && /^-?(0|[1-9]\d*)$/.test(value)) {
    amount = BigInt(value)
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    amount = BigInt(value)
  } else {
    throw new TypeError("Invalid journal row amount_minor")
  }

  assertSqliteIntegerRange(amount, "amountMinor")
  return amount
}
