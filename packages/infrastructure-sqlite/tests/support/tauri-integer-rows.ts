import type { SqliteDatabase } from "../../src/database/sqlite-database.js"
import type { SqliteReader } from "../../src/database/sqlite-executor.js"
import type { SqliteParameters } from "../../src/database/sqlite-value.js"

/** Simulates the Tauri IPC contract, which transports SQLite integers as strings. */
export function withTauriIntegerRows(database: SqliteDatabase): SqliteDatabase {
  const wrap = (reader: SqliteReader): SqliteReader => ({
    query: async <Row extends Record<string, unknown>>(
      sql: string,
      parameters?: SqliteParameters
    ): Promise<Row[]> =>
      (await reader.query<Row>(sql, parameters)).map(
        (row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              typeof value === "number" || typeof value === "bigint"
                ? String(value)
                : value,
            ])
          ) as Row
      ),
  })
  return new Proxy(database, {
    get(target, property) {
      if (property === "query") return wrap(target).query
      if (property === "readTransaction") {
        return <T>(work: (reader: SqliteReader) => Promise<T>): Promise<T> =>
          target.readTransaction((reader) => work(wrap(reader)))
      }
      const value = Reflect.get(target, property, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
