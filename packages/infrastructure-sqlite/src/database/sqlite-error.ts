import { ApplicationError } from "@workspace/application"
import { DomainError } from "@workspace/domain"

const SQLITE_INT64_MIN = -9223372036854775808n
const SQLITE_INT64_MAX = 9223372036854775807n

export type NormalizedSqliteError = {
  readonly code?: string
  readonly extendedCode?: number
  readonly message: string
  readonly cause: unknown
}

export function parseSqliteError(cause: unknown): NormalizedSqliteError {
  const error = asRecord(cause)
  const code = typeof error.code === "string" ? error.code : undefined
  const extendedCode = readExtendedCode(error)
  const message = cause instanceof Error ? cause.message : String(cause)

  return { code, extendedCode, message, cause }
}

export function mapSqliteError(
  error: unknown
): ApplicationError | DomainError | unknown {
  if (error instanceof ApplicationError || error instanceof DomainError) {
    return error
  }

  const normalized = parseSqliteError(error)
  if (isUniqueConstraint(normalized)) {
    return new ApplicationError(
      "DUPLICATE_ENTITY",
      "The requested entity already exists"
    )
  }

  return new ApplicationError("UNEXPECTED_ERROR", "SQLite operation failed")
}

export function assertSqliteIntegerRange(
  value: bigint,
  field = "SQLite integer"
): void {
  if (value < SQLITE_INT64_MIN || value > SQLITE_INT64_MAX) {
    throw new ApplicationError(
      "UNEXPECTED_ERROR",
      `${field} is outside the supported SQLite range`
    )
  }
}

export function assertSqliteSequence(value: bigint): void {
  if (value < 1n || value > SQLITE_INT64_MAX) {
    throw new ApplicationError(
      "UNEXPECTED_ERROR",
      "Journal sequence is outside the supported SQLite range"
    )
  }
}

export const SQLITE_INT64 = {
  min: SQLITE_INT64_MIN,
  max: SQLITE_INT64_MAX,
} as const

function isUniqueConstraint(error: NormalizedSqliteError): boolean {
  return (
    error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    error.extendedCode === 1555 ||
    error.extendedCode === 2067
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function readExtendedCode(error: Record<string, unknown>): number | undefined {
  if (typeof error.extendedCode === "number") {
    return error.extendedCode
  }

  return typeof error.errno === "number" ? error.errno : undefined
}
