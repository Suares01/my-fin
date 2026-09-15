import {
  type LedgerAccountId,
  type BookId,
  type LocalDate,
} from "@workspace/domain"
import type {
  AccountBalanceView,
  AccountBalanceItemView,
  AccountStatementItem,
  JournalEntryListItem,
  JournalEntryCursorKey,
  ListJournalEntriesInput,
  LedgerReadQueries,
  ListAccountStatementInput,
  QuerySlice,
  StatementCursorKey,
  ListAccountBalancesInput,
  LedgerQueries,
} from "@workspace/application"
import type { LedgerAccountKind } from "@workspace/domain"
import type { SqliteDatabase, SqliteReader } from "../database/index.js"
import {
  readAccountKind,
  readAccountStatus,
  readBigInt,
  readInteger,
  readJournalOrigin,
  readString,
  toDisplayMinor,
} from "./sqlite-query-values.js"

type AccountRow = {
  readonly account_id: unknown
  readonly account_name: unknown
  readonly kind: unknown
  readonly base_currency: unknown
  readonly status: unknown
  readonly version: unknown
}

type PostingRow = {
  readonly journal_entry_id: unknown
  readonly occurred_on: unknown
  readonly recorded_at: unknown
  readonly sequence: unknown
  readonly description: unknown
  readonly amount_minor: unknown
  readonly currency: unknown
}

export class SqliteLedgerQueries implements LedgerQueries, LedgerReadQueries {
  public constructor(private readonly executor: SqliteDatabase) {}

  public async getAccountBalance(input: {
    bookId: BookId
    accountId: LedgerAccountId
    asOf?: LocalDate
  }): Promise<AccountBalanceView> {
    return this.executor.readTransaction(async (reader) => {
      const account = await this.findAccount(
        reader,
        input.bookId,
        input.accountId
      )
      let parameters: readonly (string | null)[] = [
        input.bookId,
        input.accountId,
      ]
      let sql =
        "SELECT CAST(p.amount_minor AS TEXT) AS amount_minor " +
        "FROM postings p JOIN journal_entries e " +
        "ON e.id = p.journal_entry_id AND e.book_id = p.book_id " +
        "WHERE p.book_id = ? AND p.account_id = ?"

      if (input.asOf !== undefined) {
        sql += " AND e.occurred_on <= ?"
        parameters = [input.bookId, input.accountId, input.asOf.value]
      }

      const rows = await reader.query<Pick<PostingRow, "amount_minor">>(
        sql,
        parameters
      )
      const rawBalance = rows.reduce(
        (balance, row) =>
          balance + readBigInt(row.amount_minor, "amount_minor"),
        0n
      )
      const kind = readAccountKind(account.kind)
      const displayBalanceMinor = toDisplayMinor(rawBalance, kind)

      return {
        accountId: readString(account.account_id, "account_id"),
        accountName: readString(account.account_name, "account_name"),
        accountKind: kind,
        rawBalanceMinor: rawBalance.toString(),
        displayBalanceMinor,
        asOf: input.asOf?.value ?? null,
        amountMinor: displayBalanceMinor,
        currency: readString(account.base_currency, "base_currency"),
      }
    })
  }

  public async listAccountBalances(
    input: ListAccountBalancesInput
  ): Promise<readonly AccountBalanceItemView[]> {
    if (input.accountKinds !== undefined && input.accountKinds.length === 0) {
      return []
    }

    return this.executor.readTransaction(async (reader) => {
      const parameters: (string | null)[] = []
      let sql =
        "SELECT a.id AS account_id, a.name AS account_name, a.kind, a.status, a.version, " +
        "b.base_currency, " +
        "'0' AS raw_balance_minor " +
        "FROM ledger_accounts a JOIN financial_books b " +
        "ON b.id = a.book_id "

      sql += " WHERE a.book_id = ?"
      parameters.push(input.bookId)

      if (input.accountKinds !== undefined) {
        sql += ` AND a.kind IN (${input.accountKinds.map(() => "?").join(", ")})`
        parameters.push(...input.accountKinds)
      }

      sql += " ORDER BY a.kind ASC, a.name ASC, a.id ASC"

      const rows = await reader.query<AccountBalanceRow>(sql, parameters)
      const totals = new Map<string, bigint>()
      let afterId = ""
      for (;;) {
        const postingParameters: string[] = [input.bookId, afterId]
        let postingSql =
          "SELECT p.id AS posting_id,p.account_id,CAST(p.amount_minor AS TEXT) amount_minor FROM postings p JOIN journal_entries e ON e.id=p.journal_entry_id AND e.book_id=p.book_id WHERE p.book_id=? AND p.id>?"
        if (input.asOf !== undefined) {
          postingSql += " AND e.occurred_on<=?"
          postingParameters.push(input.asOf.value)
        }
        postingSql += " ORDER BY p.id ASC LIMIT 512"
        const postings = await reader.query<{
          readonly posting_id: unknown
          readonly account_id: unknown
          readonly amount_minor: unknown
        }>(postingSql, postingParameters)
        for (const posting of postings) {
          const id = readString(posting.account_id, "account_id")
          totals.set(
            id,
            (totals.get(id) ?? 0n) +
              readBigInt(posting.amount_minor, "amount_minor")
          )
        }
        if (postings.length < 512) break
        afterId = readString(postings.at(-1)?.posting_id, "posting_id")
      }
      return rows.flatMap((row) => {
        const status = readAccountStatus(row.status)
        if (!input.includeArchived && status === "ARCHIVED") {
          return []
        }

        const kind = readAccountKind(row.kind)
        const rawBalanceMinor =
          totals.get(readString(row.account_id, "account_id")) ?? 0n
        if (!input.includeZeroBalance && rawBalanceMinor === 0n) {
          return []
        }

        const displayBalanceMinor = toDisplayMinor(rawBalanceMinor, kind)
        return [
          {
            accountId: readString(row.account_id, "account_id"),
            accountName: readString(row.account_name, "account_name"),
            accountKind: kind,
            rawBalanceMinor: rawBalanceMinor.toString(),
            displayBalanceMinor,
            amountMinor: displayBalanceMinor,
            currency: readString(row.base_currency, "base_currency"),
            asOf: input.asOf?.value ?? null,
            archived: status === "ARCHIVED",
            version: readInteger(row.version, "account_version"),
          } satisfies AccountBalanceItemView,
        ]
      })
    })
  }

  public async listAccountStatement(
    input: ListAccountStatementInput
  ): Promise<QuerySlice<AccountStatementItem, StatementCursorKey>> {
    return this.executor.readTransaction(async (reader) => {
      const rows = await this.readStatementPage(reader, input)
      const hasMore = rows.length > input.limit
      const pageRows = hasMore ? rows.slice(0, input.limit) : rows
      const counterparties = await this.readCounterparties(
        reader,
        input,
        pageRows.map((row) => readString(row.entry_id, "entry_id"))
      )
      const accountKind =
        pageRows[0] === undefined
          ? undefined
          : readAccountKind(pageRows[0].account_kind)
      if (pageRows.length > 0 && accountKind === undefined) {
        throw new TypeError("Missing statement account kind")
      }
      const items = pageRows.map((row) => {
        const rawAmountMinor = readBigInt(
          row.raw_amount_minor,
          "raw_amount_minor"
        )
        const rawRunningBalanceMinor = readBigInt(
          row.raw_running_balance_minor,
          "raw_running_balance_minor"
        )
        const entryId = readString(row.entry_id, "entry_id")
        return {
          entryId,
          postingId: readString(row.posting_id, "posting_id"),
          occurredOn: readString(row.occurred_on, "occurred_on"),
          recordedAt: readString(row.recorded_at, "recorded_at"),
          sequence: readString(row.sequence, "sequence"),
          description: readString(row.description, "description"),
          rawAmountMinor: rawAmountMinor.toString(),
          displayAmountMinor: toDisplayMinor(
            rawAmountMinor,
            accountKind as LedgerAccountKind
          ),
          runningBalanceMinor: toDisplayMinor(
            rawRunningBalanceMinor,
            accountKind as LedgerAccountKind
          ),
          currency: readString(row.currency, "currency"),
          origin: readJournalOrigin(row.origin),
          counterpartyAccounts: counterparties.get(entryId) ?? [],
          isReversal: row.reversal_of_id !== null,
          isReversed: row.reversed_by_id !== null,
        } satisfies AccountStatementItem
      })
      const last = items.at(-1)
      return {
        items,
        nextKey:
          hasMore && last !== undefined
            ? {
                occurredOn: last.occurredOn,
                sequence: last.sequence,
                postingPosition: readInteger(
                  pageRows.at(-1)?.posting_position,
                  "posting_position"
                ),
              }
            : null,
      }
    })
  }

  public async listJournalEntries(
    input: ListJournalEntriesInput
  ): Promise<QuerySlice<JournalEntryListItem, JournalEntryCursorKey>> {
    return this.executor.readTransaction(async (reader) => {
      const rows = await this.readJournalPage(reader, input)
      const hasMore = rows.length > input.limit
      const pageRows = hasMore ? rows.slice(0, input.limit) : rows
      const entries = await this.readJournalPostings(
        reader,
        input,
        pageRows.map((row) => readString(row.entry_id, "entry_id"))
      )
      const items = pageRows.map((row) => {
        const entryId = readString(row.entry_id, "entry_id")
        const postings = entries.get(entryId) ?? []
        return toJournalItem(row, postings)
      })
      const last = items.at(-1)
      return {
        items,
        nextKey:
          hasMore && last !== undefined
            ? { occurredOn: last.occurredOn, sequence: last.sequence }
            : null,
      }
    })
  }

  private async readJournalPage(
    reader: SqliteReader,
    input: ListJournalEntriesInput
  ): Promise<readonly JournalPageRow[]> {
    const parameters: (string | number)[] = [input.bookId]
    let sql =
      "SELECT e.id AS entry_id, e.occurred_on, e.recorded_at, " +
      "CAST(e.sequence AS TEXT) AS sequence, e.description, e.origin, " +
      "e.currency, e.reversal_of_id, e.reversed_by_id " +
      "FROM journal_entries e WHERE e.book_id = ?"

    if (input.from !== undefined) {
      sql += " AND e.occurred_on >= ?"
      parameters.push(input.from.value)
    }
    if (input.to !== undefined) {
      sql += " AND e.occurred_on <= ?"
      parameters.push(input.to.value)
    }
    if (input.accountIds !== undefined) {
      sql +=
        " AND EXISTS (SELECT 1 FROM postings filter_posting " +
        "WHERE filter_posting.book_id = e.book_id " +
        "AND filter_posting.journal_entry_id = e.id " +
        `AND filter_posting.account_id IN (${input.accountIds.map(() => "?").join(", ")}))`
      parameters.push(...input.accountIds)
    }
    if (input.categoryIds !== undefined) {
      sql +=
        " AND EXISTS (SELECT 1 FROM postings filter_category_posting " +
        "WHERE filter_category_posting.book_id = e.book_id " +
        "AND filter_category_posting.journal_entry_id = e.id " +
        `AND filter_category_posting.account_id IN (${input.categoryIds.map(() => "?").join(", ")}))`
      parameters.push(...input.categoryIds)
    }
    if (input.origins !== undefined) {
      sql += ` AND e.origin IN (${input.origins.map(() => "?").join(", ")})`
      parameters.push(...input.origins)
    }
    if (input.search !== undefined) {
      sql += " AND instr(e.description, ?) > 0"
      parameters.push(input.search)
    }
    if (input.cursor !== undefined) {
      sql +=
        " AND (e.occurred_on < ? OR (e.occurred_on = ? AND (" +
        "length(e.sequence) < length(?) OR " +
        "(length(e.sequence) = length(?) AND e.sequence < ?))))"
      parameters.push(
        input.cursor.occurredOn,
        input.cursor.occurredOn,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.sequence
      )
    }

    sql +=
      " ORDER BY e.occurred_on DESC, length(e.sequence) DESC, e.sequence DESC " +
      "LIMIT ?"
    parameters.push(input.limit + 1)
    return reader.query<JournalPageRow>(sql, parameters)
  }

  private async readJournalPostings(
    reader: SqliteReader,
    input: ListJournalEntriesInput,
    entryIds: readonly string[]
  ): Promise<ReadonlyMap<string, readonly JournalPostingRow[]>> {
    const rows =
      entryIds.length === 0
        ? await reader.query<JournalPostingRow>(
            "SELECT p.journal_entry_id AS entry_id, p.amount_minor, " +
              "a.id AS account_id, a.name AS account_name, a.kind AS account_kind " +
              "FROM postings p JOIN ledger_accounts a ON a.id = p.account_id " +
              "AND a.book_id = p.book_id WHERE 1 = 0"
          )
        : await reader.query<JournalPostingRow>(
            "SELECT p.journal_entry_id AS entry_id, " +
              "CAST(p.amount_minor AS TEXT) AS amount_minor, " +
              "a.id AS account_id, a.name AS account_name, a.kind AS account_kind " +
              "FROM postings p JOIN ledger_accounts a ON a.id = p.account_id " +
              "AND a.book_id = p.book_id WHERE p.book_id = ? " +
              `AND p.journal_entry_id IN (${entryIds.map(() => "?").join(", ")}) ` +
              "ORDER BY a.name ASC, a.id ASC",
            [input.bookId, ...entryIds]
          )
    const grouped = new Map<string, JournalPostingRow[]>()
    for (const row of rows) {
      const entryId = readString(row.entry_id, "entry_id")
      const current = grouped.get(entryId) ?? []
      current.push(row)
      grouped.set(entryId, current)
    }
    return grouped
  }

  private async readStatementPage(
    reader: SqliteReader,
    input: ListAccountStatementInput
  ): Promise<readonly StatementRow[]> {
    const parameters: (string | number)[] = [input.bookId, input.accountId]
    let sql =
      "WITH history AS (" +
      "SELECT p.id AS posting_id, p.position AS posting_position, " +
      "e.id AS entry_id, e.occurred_on, e.recorded_at, " +
      "CAST(e.sequence AS TEXT) AS sequence, e.description, e.currency, e.origin, " +
      "e.reversal_of_id, e.reversed_by_id, a.kind AS account_kind, " +
      "CAST(p.amount_minor AS TEXT) AS raw_amount_minor, " +
      "CAST(SUM(p.amount_minor) OVER (" +
      "ORDER BY e.occurred_on ASC, length(e.sequence) ASC, " +
      "e.sequence ASC, p.position ASC ROWS UNBOUNDED PRECEDING" +
      ") AS TEXT) AS raw_running_balance_minor " +
      "FROM postings p JOIN journal_entries e " +
      "ON e.id = p.journal_entry_id AND e.book_id = p.book_id " +
      "JOIN ledger_accounts a ON a.id = p.account_id AND a.book_id = p.book_id " +
      "WHERE p.book_id = ? AND p.account_id = ?" +
      ") SELECT * FROM history WHERE 1 = 1"

    if (input.from !== undefined) {
      sql += " AND occurred_on >= ?"
      parameters.push(input.from.value)
    }
    if (input.to !== undefined) {
      sql += " AND occurred_on <= ?"
      parameters.push(input.to.value)
    }
    if (input.cursor !== undefined) {
      sql +=
        " AND (occurred_on < ? OR (occurred_on = ? AND (" +
        "length(sequence) < length(?) OR (length(sequence) = length(?) AND " +
        "(sequence < ? OR (sequence = ? AND posting_position < ?))))))"
      parameters.push(
        input.cursor.occurredOn,
        input.cursor.occurredOn,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.postingPosition
      )
    }

    sql +=
      " ORDER BY occurred_on DESC, length(sequence) DESC, sequence DESC, " +
      "posting_position DESC LIMIT ?"
    parameters.push(input.limit + 1)
    return reader.query<StatementRow>(sql, parameters)
  }

  private async readCounterparties(
    reader: SqliteReader,
    input: ListAccountStatementInput,
    entryIds: readonly string[]
  ): Promise<ReadonlyMap<string, readonly AccountSummaryRow[]>> {
    const rows =
      entryIds.length === 0
        ? await reader.query<CounterpartyRow>(
            "SELECT p.journal_entry_id AS entry_id, a.id AS account_id, " +
              "a.name AS account_name, a.kind AS account_kind " +
              "FROM postings p JOIN ledger_accounts a ON a.id = p.account_id " +
              "AND a.book_id = p.book_id WHERE 1 = 0"
          )
        : await reader.query<CounterpartyRow>(
            "SELECT DISTINCT p.journal_entry_id AS entry_id, a.id AS account_id, " +
              "a.name AS account_name, a.kind AS account_kind " +
              "FROM postings p JOIN ledger_accounts a ON a.id = p.account_id " +
              "AND a.book_id = p.book_id WHERE p.book_id = ? " +
              `AND p.journal_entry_id IN (${entryIds.map(() => "?").join(", ")}) ` +
              "AND p.account_id <> ? ORDER BY a.name ASC, a.id ASC",
            [input.bookId, ...entryIds, input.accountId]
          )
    const grouped = new Map<string, AccountSummaryRow[]>()
    for (const row of rows) {
      const entryId = readString(row.entry_id, "entry_id")
      const current = grouped.get(entryId) ?? []
      current.push({
        id: readString(row.account_id, "account_id"),
        name: readString(row.account_name, "account_name"),
        kind: readAccountKind(row.account_kind),
      })
      grouped.set(entryId, current)
    }
    return grouped
  }

  private async findAccount(
    reader: SqliteReader,
    bookId: BookId,
    accountId: LedgerAccountId
  ): Promise<AccountRow> {
    const rows = await reader.query<AccountRow>(
      "SELECT a.id AS account_id, a.name AS account_name, a.kind, b.base_currency " +
        "FROM ledger_accounts a JOIN financial_books b ON b.id = a.book_id " +
        "WHERE a.book_id = ? AND a.id = ?",
      [bookId, accountId]
    )
    const row = rows[0]
    if (row === undefined) {
      throw new Error(`Ledger account ${accountId} was not found`)
    }

    return row
  }
}

type AccountBalanceRow = {
  readonly account_id: unknown
  readonly account_name: unknown
  readonly kind: unknown
  readonly status: unknown
  readonly version: unknown
  readonly base_currency: unknown
  readonly raw_balance_minor: unknown
}

type StatementRow = {
  readonly posting_id: unknown
  readonly posting_position: unknown
  readonly entry_id: unknown
  readonly occurred_on: unknown
  readonly recorded_at: unknown
  readonly sequence: unknown
  readonly description: unknown
  readonly currency: unknown
  readonly origin: unknown
  readonly reversal_of_id: unknown
  readonly reversed_by_id: unknown
  readonly account_kind: unknown
  readonly raw_amount_minor: unknown
  readonly raw_running_balance_minor: unknown
}

type CounterpartyRow = {
  readonly entry_id: unknown
  readonly account_id: unknown
  readonly account_name: unknown
  readonly account_kind: unknown
}

type AccountSummaryRow = {
  readonly id: string
  readonly name: string
  readonly kind: LedgerAccountKind
}

type JournalPageRow = {
  readonly entry_id: unknown
  readonly occurred_on: unknown
  readonly recorded_at: unknown
  readonly sequence: unknown
  readonly description: unknown
  readonly origin: unknown
  readonly currency: unknown
  readonly reversal_of_id: unknown
  readonly reversed_by_id: unknown
}

type JournalPostingRow = {
  readonly entry_id: unknown
  readonly amount_minor: unknown
  readonly account_id: unknown
  readonly account_name: unknown
  readonly account_kind: unknown
}

function toJournalItem(
  row: JournalPageRow,
  rows: readonly JournalPostingRow[]
): JournalEntryListItem {
  const financialAccounts = new Map<string, AccountSummaryRow>()
  const categories = new Map<string, AccountSummaryRow>()
  let incomeMinor = 0n
  let expenseMinor = 0n
  let categoryPostingCount = 0
  const postingAmounts: bigint[] = []

  for (const posting of rows) {
    const accountId = readString(posting.account_id, "account_id")
    const accountName = readString(posting.account_name, "account_name")
    const kind = readAccountKind(posting.account_kind)
    const summary = {
      id: accountId,
      name: accountName,
      kind,
    } satisfies AccountSummaryRow
    if (kind === "ASSET" || kind === "LIABILITY") {
      financialAccounts.set(accountId, summary)
    }
    if (kind === "INCOME" || kind === "EXPENSE") {
      categories.set(accountId, summary)
      categoryPostingCount += 1
      const amount = readBigInt(posting.amount_minor, "amount_minor")
      postingAmounts.push(amount)
      if (kind === "INCOME") {
        incomeMinor += BigInt(toDisplayMinor(amount, kind))
      } else {
        expenseMinor += BigInt(toDisplayMinor(amount, kind))
      }
    } else {
      postingAmounts.push(readBigInt(posting.amount_minor, "amount_minor"))
    }
  }

  const isTransfer =
    rows.length === 2 &&
    rows.every((posting) => {
      const kind = readAccountKind(posting.account_kind)
      return kind === "ASSET" || kind === "LIABILITY"
    })
  const transferMinor =
    isTransfer && postingAmounts[0] !== undefined
      ? (postingAmounts[0] < 0n
          ? -postingAmounts[0]
          : postingAmounts[0]
        ).toString()
      : "0"

  return {
    id: readString(row.entry_id, "entry_id"),
    occurredOn: readString(row.occurred_on, "occurred_on"),
    recordedAt: readString(row.recorded_at, "recorded_at"),
    sequence: readString(row.sequence, "sequence"),
    description: readString(row.description, "description"),
    origin: readJournalOrigin(row.origin),
    financialAccounts: sortAccountSummaries([...financialAccounts.values()]),
    categories: sortAccountSummaries([...categories.values()]),
    incomeMinor: incomeMinor.toString(),
    expenseMinor: expenseMinor.toString(),
    transferMinor,
    currency: readString(row.currency, "currency"),
    isSplit: categoryPostingCount > 1,
    isReversal: row.reversal_of_id !== null,
    isReversed: row.reversed_by_id !== null,
  }
}

function sortAccountSummaries(
  summaries: readonly AccountSummaryRow[]
): readonly AccountSummaryRow[] {
  return summaries
    .slice()
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    )
}
