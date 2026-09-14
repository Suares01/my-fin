import {
  ApplicationError,
  type InvestmentSequenceStore,
} from "@workspace/application"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import {
  assertSqliteSequence,
  mapSqliteError,
} from "../database/sqlite-error.js"

export class SqliteInvestmentSequenceStore implements InvestmentSequenceStore {
  public constructor(private readonly executor: SqliteExecutor) {}
  public async next(bookId: string): Promise<string> {
    try {
      const row = (
        await this.executor.query<{ readonly sequence: unknown }>(
          "INSERT INTO investment_sequences (book_id, last_sequence) VALUES (?, 1) ON CONFLICT(book_id) DO UPDATE SET last_sequence = last_sequence + 1 WHERE last_sequence < 9223372036854775807 RETURNING CAST(last_sequence AS TEXT) AS sequence",
          [bookId]
        )
      )[0]
      if (typeof row?.sequence !== "string")
        throw new ApplicationError(
          "UNEXPECTED_ERROR",
          "Investment sequence is outside the supported SQLite range"
        )
      assertSqliteSequence(BigInt(row.sequence))
      return row.sequence
    } catch (error) {
      throw mapSqliteError(error)
    }
  }
}
