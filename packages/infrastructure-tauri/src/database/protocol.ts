import type {
  SqliteExecutionResult,
  SqliteParameters,
  SqliteValue,
} from "@workspace/infrastructure-sqlite"

const INT64_PATTERN = /^-?(?:0|[1-9]\d*)$/
const INT64_MIN = -9223372036854775808n
const INT64_MAX = 9223372036854775807n

export type IpcSqliteValue =
  | { readonly type: "null" }
  | { readonly type: "integer"; readonly value: string }
  | { readonly type: "real"; readonly value: number }
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "blob"; readonly value: readonly number[] }

export type IpcParameters =
  | {
      readonly kind: "positional"
      readonly values: readonly IpcSqliteValue[]
    }
  | {
      readonly kind: "named"
      readonly values: Readonly<Record<string, IpcSqliteValue>>
    }

export type IpcRow = Readonly<Record<string, IpcSqliteValue>>

export type IpcExecutionResult = {
  readonly rowsAffected: number
  readonly lastInsertRowId?: string
}

export type IpcDatabaseError = {
  readonly code: string
  readonly diagnosticId: string
  readonly message: string
}

export const IPC_CODEC_ERRORS = {
  INVALID_VALUE: "INVALID_IPC_VALUE",
  INVALID_PARAMETERS: "INVALID_IPC_PARAMETERS",
  INVALID_ROW: "INVALID_IPC_ROW",
  INVALID_RESULT: "INVALID_IPC_RESULT",
  INVALID_ERROR: "INVALID_IPC_ERROR",
  DATABASE_FAILURE: "DATABASE_OPERATION_FAILED",
} as const

export type IpcCodecErrorCode =
  (typeof IPC_CODEC_ERRORS)[keyof typeof IPC_CODEC_ERRORS]

export class IpcCodecError extends Error {
  readonly code: IpcCodecErrorCode

  constructor(code: IpcCodecErrorCode, message: string) {
    super(message)
    this.name = "IpcCodecError"
    this.code = code
  }
}

export class TauriDatabaseError extends Error {
  readonly code: string
  readonly diagnosticId: string

  constructor(error: IpcDatabaseError) {
    super(error.message)
    this.name = "TauriDatabaseError"
    this.code = error.code
    this.diagnosticId = error.diagnosticId
  }
}

export function encodeSqliteValue(value: SqliteValue): IpcSqliteValue {
  if (value === null) {
    return { type: "null" }
  }

  if (typeof value === "string") {
    return { type: "text", value }
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new IpcCodecError(
        IPC_CODEC_ERRORS.INVALID_VALUE,
        "SQLite numeric value must be finite"
      )
    }

    if (Number.isInteger(value)) {
      if (!Number.isSafeInteger(value)) {
        throw new IpcCodecError(
          IPC_CODEC_ERRORS.INVALID_VALUE,
          "SQLite integer value must be safe"
        )
      }

      return { type: "integer", value: String(value) }
    }

    return { type: "real", value }
  }

  if (value instanceof Uint8Array) {
    return { type: "blob", value: Array.from(value) }
  }

  throw new IpcCodecError(
    IPC_CODEC_ERRORS.INVALID_VALUE,
    "Unsupported SQLite value"
  )
}

export function decodeIpcValue(value: unknown): SqliteValue {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw invalidValue("SQLite value tag")
  }

  switch (value.type) {
    case "null":
      ensureOnlyType(value, "null")
      return null
    case "integer":
      return decodeInteger(value.value)
    case "real":
      return decodeReal(value.value)
    case "text":
      return decodeText(value.value)
    case "blob":
      return decodeBlob(value.value)
    default:
      throw invalidValue("Unknown SQLite value tag")
  }
}

export function encodeSqliteParameters(
  parameters?: SqliteParameters
): IpcParameters {
  if (parameters === undefined) {
    return { kind: "positional", values: [] }
  }

  if (Array.isArray(parameters)) {
    return {
      kind: "positional",
      values: parameters.map(encodeSqliteValue),
    }
  }

  if (isRecord(parameters)) {
    return {
      kind: "named",
      values: Object.fromEntries(
        Object.entries(parameters).map(([key, value]) => [
          key,
          encodeSqliteValue(value as SqliteValue),
        ])
      ),
    }
  }

  throw new IpcCodecError(
    IPC_CODEC_ERRORS.INVALID_PARAMETERS,
    "SQLite parameters must be positional or named"
  )
}

export function decodeIpcRow(row: unknown): Record<string, SqliteValue> {
  if (!isRecord(row)) {
    throw new IpcCodecError(
      IPC_CODEC_ERRORS.INVALID_ROW,
      "SQLite row must be an object"
    )
  }

  const decoded: Record<string, SqliteValue> = {}
  for (const [key, value] of Object.entries(row)) {
    try {
      decoded[key] = decodeIpcValue(value)
    } catch (error) {
      throw new IpcCodecError(
        IPC_CODEC_ERRORS.INVALID_ROW,
        error instanceof Error ? error.message : "Invalid SQLite row value"
      )
    }
  }

  return decoded
}

export function decodeIpcRows(rows: unknown): Record<string, SqliteValue>[] {
  if (!Array.isArray(rows)) {
    throw new IpcCodecError(
      IPC_CODEC_ERRORS.INVALID_ROW,
      "SQLite rows must be an array"
    )
  }

  return rows.map(decodeIpcRow)
}

export function decodeIpcExecutionResult(
  result: unknown
): SqliteExecutionResult {
  if (
    !isRecord(result) ||
    typeof result.rowsAffected !== "number" ||
    !Number.isSafeInteger(result.rowsAffected)
  ) {
    throw new IpcCodecError(
      IPC_CODEC_ERRORS.INVALID_RESULT,
      "Invalid SQLite execution result"
    )
  }

  if (
    result.lastInsertRowId !== undefined &&
    !isInt64String(result.lastInsertRowId)
  ) {
    throw new IpcCodecError(
      IPC_CODEC_ERRORS.INVALID_RESULT,
      "Invalid SQLite last insert row ID"
    )
  }

  return {
    rowsAffected: result.rowsAffected,
    ...(result.lastInsertRowId === undefined
      ? {}
      : { lastInsertRowId: result.lastInsertRowId }),
  }
}

export function decodeIpcError(error: unknown): TauriDatabaseError {
  const safe = sanitizeIpcError(error)
  const rawMessage = isRecord(error)
    ? typeof error.message === "string"
      ? error.message
      : undefined
    : error instanceof Error
      ? error.message
      : undefined
  console.error("[sqlite/ipc] operation failed", {
    code: safe.code,
    diagnosticId: safe.diagnosticId,
    message: safe.message,
    rawMessage,
  })
  return new TauriDatabaseError(safe)
}

export function sanitizeIpcError(error: unknown): IpcDatabaseError {
  if (isRecord(error)) {
    const code = typeof error.code === "string" ? error.code : undefined
    const diagnosticId =
      typeof error.diagnosticId === "string" ? error.diagnosticId : undefined
    if (code !== undefined && diagnosticId !== undefined) {
      return {
        code,
        diagnosticId,
        message: "Database operation failed",
      }
    }
  }

  if (error instanceof IpcCodecError) {
    return {
      code: error.code,
      diagnosticId: "ipc-codec",
      message: "Database protocol rejected the value",
    }
  }

  return {
    code: IPC_CODEC_ERRORS.DATABASE_FAILURE,
    diagnosticId: "ipc-unknown",
    message: "Database operation failed",
  }
}

function decodeInteger(value: unknown): string {
  if (typeof value !== "string" || !isInt64String(value)) {
    throw invalidValue("SQLite integer")
  }

  return BigInt(value).toString()
}

function decodeReal(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidValue("SQLite real")
  }

  return value
}

function decodeText(value: unknown): string {
  if (typeof value !== "string") {
    throw invalidValue("SQLite text")
  }

  return value
}

function decodeBlob(value: unknown): Uint8Array {
  if (
    !Array.isArray(value) ||
    value.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw invalidValue("SQLite blob")
  }

  return Uint8Array.from(value)
}

function isInt64String(value: unknown): value is string {
  if (typeof value !== "string" || !INT64_PATTERN.test(value)) {
    return false
  }

  const parsed = BigInt(value)
  return parsed >= INT64_MIN && parsed <= INT64_MAX
}

function invalidValue(field: string): IpcCodecError {
  return new IpcCodecError(IPC_CODEC_ERRORS.INVALID_VALUE, `Invalid ${field}`)
}

function ensureOnlyType(value: Record<string, unknown>, type: string): void {
  if (Object.keys(value).some((key) => key !== "type")) {
    throw invalidValue(`Malformed ${type} value`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
