import {
  type InvestmentRequestReceipt,
  type InvestmentRequestStore,
} from "@workspace/application"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"
import { readInteger, readString } from "../queries/sqlite-query-values.js"

export class SqliteInvestmentRequestStore implements InvestmentRequestStore {
  public constructor(private readonly executor: SqliteExecutor) {}
  public async find(
    bookId: string,
    requestId: string
  ): Promise<InvestmentRequestReceipt | null> {
    const row = (
      await this.executor.query<Record<string, unknown>>(
        "SELECT book_id, request_id, format_version, canonical_command, result_json, recorded_at FROM investment_request_receipts WHERE book_id = ? AND request_id = ?",
        [bookId, requestId]
      )
    )[0]
    if (row === undefined) return null
    return {
      bookId: readString(row.book_id, "book_id"),
      requestId: readString(row.request_id, "request_id"),
      formatVersion: readInteger(row.format_version, "format_version") as 1,
      canonicalCommand: readString(row.canonical_command, "canonical_command"),
      result: JSON.parse(readString(row.result_json, "result_json")),
      recordedAt: readString(row.recorded_at, "recorded_at"),
    }
  }
  public async add(receipt: InvestmentRequestReceipt): Promise<void> {
    try {
      await this.executor.execute(
        "INSERT INTO investment_request_receipts (book_id, request_id, format_version, canonical_command, result_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          receipt.bookId,
          receipt.requestId,
          receipt.formatVersion,
          receipt.canonicalCommand,
          JSON.stringify(receipt.result),
          receipt.recordedAt,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }
  }
}
