import { normalizeSearchText } from "@workspace/domain"
import type { SqliteDatabase } from "./sqlite-database.js"

const DEFAULT_BATCH_SIZE = 100

type JournalSearchRow = {
  readonly id: unknown
  readonly description: unknown
}

export type JournalSearchBackfillOptions = {
  readonly batchSize?: number
}

/** Backfills V3 search metadata in bounded, independently committed batches. */
export async function backfillJournalSearch(
  database: SqliteDatabase,
  options: JournalSearchBackfillOptions = {}
): Promise<void> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError("Journal search backfill batchSize must be positive")
  }

  const columns = await database.query<{ readonly name: string }>(
    "SELECT name FROM pragma_table_info('journal_entries')"
  )
  const columnNames = new Set(columns.map((column) => column.name))
  if (
    !columnNames.has("id") ||
    !columnNames.has("description") ||
    !columnNames.has("search_text") ||
    !columnNames.has("search_version")
  ) {
    return
  }

  while (true) {
    const changed = await database.transaction(async (transaction) => {
      const rows = await transaction.query<JournalSearchRow>(
        "SELECT id, description FROM journal_entries " +
          "WHERE search_version = 0 ORDER BY id LIMIT ?",
        [batchSize]
      )

      for (const row of rows) {
        if (typeof row.id !== "string" || typeof row.description !== "string") {
          throw new TypeError("Invalid journal search backfill row")
        }

        await transaction.execute(
          "UPDATE journal_entries SET search_text = ?, search_version = 1 " +
            "WHERE id = ? AND search_version = 0",
          [normalizeSearchText(row.description), row.id]
        )
      }

      return rows.length
    })

    if (changed === 0) {
      return
    }
  }
}
