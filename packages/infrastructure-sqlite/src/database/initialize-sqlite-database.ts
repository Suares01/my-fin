import { sqliteMigrations } from "../migrations/generated-migrations.js"
import { SqliteMigrationRunner } from "../migrations/sqlite-migration-runner.js"
import type { SqliteMigration } from "../migrations/migrations.js"
import type { SqliteDatabase } from "./sqlite-database.js"
import {
  configureSqliteConnection,
  type SqliteConnectionOptions,
} from "./configure-sqlite-connection.js"
import { verifySqliteConnection } from "./verify-sqlite-connection.js"
import { backfillJournalSearch } from "./backfill-journal-search.js"

export type SqliteInitializationOptions = SqliteConnectionOptions & {
  readonly migrations?: readonly SqliteMigration[]
}

export async function initializeSqliteDatabase(
  database: SqliteDatabase,
  options: SqliteInitializationOptions
): Promise<void> {
  await configureSqliteConnection(database, options)
  await verifySqliteConnection(database, options)
  await new SqliteMigrationRunner(
    database,
    options.migrations ?? sqliteMigrations
  ).migrate()
  await backfillJournalSearch(database)
}
