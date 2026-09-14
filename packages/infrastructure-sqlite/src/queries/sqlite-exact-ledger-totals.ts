import type { LedgerAccountKind } from "@workspace/domain"
import type { SqliteReader } from "../database/sqlite-executor.js"
import { readBigInt, readString } from "./sqlite-query-values.js"

const PAGE_SIZE = 512

export interface ExactPostingTotalInput {
  readonly bookId: string
  readonly accountIds?: readonly string[]
  readonly accountKinds?: readonly LedgerAccountKind[]
  readonly asOf?: string
}

type PostingTotalRow = {
  readonly posting_id: unknown
  readonly amount_minor: unknown
}

/** Sums persisted postings without SQLite integer aggregation overflow. */
export class SqliteExactLedgerTotals {
  public constructor(private readonly reader: SqliteReader) {}

  public async sum(input: ExactPostingTotalInput): Promise<string> {
    if (input.accountIds?.length === 0 || input.accountKinds?.length === 0) {
      return "0"
    }

    let afterId = ""
    let total = 0n
    for (;;) {
      const parameters: string[] = [input.bookId, afterId]
      let sql =
        "SELECT p.id AS posting_id, CAST(p.amount_minor AS TEXT) AS amount_minor " +
        "FROM postings p JOIN journal_entries e " +
        "ON e.id = p.journal_entry_id AND e.book_id = p.book_id " +
        "JOIN ledger_accounts a ON a.id = p.account_id AND a.book_id = p.book_id " +
        "WHERE p.book_id = ? AND p.id > ?"

      if (input.asOf !== undefined) {
        sql += " AND e.occurred_on <= ?"
        parameters.push(input.asOf)
      }
      if (input.accountIds !== undefined) {
        sql += ` AND p.account_id IN (${input.accountIds.map(() => "?").join(", ")})`
        parameters.push(...input.accountIds)
      }
      if (input.accountKinds !== undefined) {
        sql += ` AND a.kind IN (${input.accountKinds.map(() => "?").join(", ")})`
        parameters.push(...input.accountKinds)
      }
      sql += " ORDER BY p.id ASC LIMIT ?"
      parameters.push(String(PAGE_SIZE))

      const rows = await this.reader.query<PostingTotalRow>(sql, parameters)
      for (const row of rows) {
        total += readBigInt(row.amount_minor, "amount_minor")
      }
      if (rows.length < PAGE_SIZE) {
        return total.toString()
      }
      afterId = readString(rows.at(-1)?.posting_id, "posting_id")
    }
  }
}
