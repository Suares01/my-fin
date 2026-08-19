export type SqliteValue = string | number | Uint8Array | null

export type SqliteParameters =
  | readonly SqliteValue[]
  | Readonly<Record<string, SqliteValue>>

export type SqliteExecutionResult = {
  readonly rowsAffected: number
  readonly lastInsertRowId?: string
}
