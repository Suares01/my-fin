import type { SqliteExecutor, SqliteReader } from "./sqlite-executor.js"

export interface SqliteDatabase extends SqliteExecutor {
  transaction<T>(work: (transaction: SqliteExecutor) => Promise<T>): Promise<T>
  readTransaction<T>(work: (reader: SqliteReader) => Promise<T>): Promise<T>
  close(): Promise<void>
}
