import { LocalDate } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type {
  JournalEntryCursorKey,
  StatementCursorKey,
} from "../ports/ledger-read-queries.js"
import { invalidQuery } from "./query-validation.js"

const DECIMAL_PATTERN = /^(0|[1-9]\d*)$/

export function encodeStatementCursor(key: StatementCursorKey): string {
  validateDate(key.occurredOn, "cursor.occurredOn")
  validateSequence(key.sequence, "cursor.sequence")
  validatePostingPosition(key.postingPosition)
  return `s1.${key.occurredOn}.${key.sequence}.${key.postingPosition}`
}

export function decodeStatementCursor(value: unknown): StatementCursorKey {
  const fields = splitCursor(value, "s1", 4)
  const occurredOn = validateDate(fields[1], "cursor.occurredOn")
  const sequence = validateSequence(fields[2], "cursor.sequence")
  const postingPosition = validatePostingPosition(
    parseCursorInteger(fields[3], "cursor.postingPosition")
  )
  return { occurredOn, sequence, postingPosition }
}

export function encodeJournalEntryCursor(key: JournalEntryCursorKey): string {
  validateDate(key.occurredOn, "cursor.occurredOn")
  validateSequence(key.sequence, "cursor.sequence")
  return `j1.${key.occurredOn}.${key.sequence}`
}

export function decodeJournalEntryCursor(
  value: unknown
): JournalEntryCursorKey {
  const fields = splitCursor(value, "j1", 3)
  const occurredOn = validateDate(fields[1], "cursor.occurredOn")
  const sequence = validateSequence(fields[2], "cursor.sequence")
  return { occurredOn, sequence }
}

function splitCursor(
  value: unknown,
  prefix: string,
  expectedLength: number
): readonly string[] {
  if (typeof value !== "string") {
    throw invalidCursor()
  }

  const fields = value.split(".")
  if (fields.length !== expectedLength || fields[0] !== prefix) {
    throw invalidCursor()
  }

  return fields
}

function validateDate(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw invalidCursor()
  }

  try {
    return LocalDate.parse(value).value
  } catch {
    throw invalidQuery(field)
  }
}

function validateSequence(value: unknown, field: string): string {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw invalidQuery(field)
  }

  return value
}

function parseCursorInteger(value: unknown, field: string): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw invalidQuery(field)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw invalidQuery(field)
  }

  return parsed
}

function validatePostingPosition(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalidQuery("cursor.postingPosition")
  }

  return value
}

function invalidCursor(): ApplicationError {
  return new ApplicationError("INVALID_QUERY", "Invalid financial query cursor")
}
