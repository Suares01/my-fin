import type { SqliteDatabase } from "./sqlite-database.js"

export type SqliteConnectionOptions = {
  readonly inMemory: boolean
}

type TransactionAwareDatabase = SqliteDatabase & {
  readonly isTransactionActive?: boolean
}

export async function configureSqliteConnection(
  database: SqliteDatabase,
  options: SqliteConnectionOptions
): Promise<void> {
  if ((database as TransactionAwareDatabase).isTransactionActive === true) {
    throw new Error(
      "SQLite connection must be configured before starting a transaction"
    )
  }

  await database.executeBatch(
    "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;"
  )

  if (!options.inMemory) {
    await database.executeBatch(
      "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;"
    )
  }
}
