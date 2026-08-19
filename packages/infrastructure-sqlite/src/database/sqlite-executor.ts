import type { SqliteExecutionResult, SqliteParameters } from "./sqlite-value.js"

export interface SqliteReader {
  query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<Row[]>
}

export interface SqliteExecutor extends SqliteReader {
  execute(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<SqliteExecutionResult>
  executeBatch(sql: string): Promise<void>
}
