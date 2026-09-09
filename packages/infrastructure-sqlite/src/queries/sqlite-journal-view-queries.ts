import type {
  GetJournalChainSummaryInput,
  GetJournalChainDetailInput,
  JournalBusinessType,
  JournalChainDetail,
  JournalChainListItem,
  JournalChainStatus,
  JournalChainSummary,
  JournalHistoryItem,
  JournalHistoryRole,
  JournalPostingView,
  JournalViewQueries,
  ListJournalChainsInput,
  QuerySlice,
  JournalChainCursorKey,
} from "@workspace/application"
import type { LedgerAccountKind } from "@workspace/domain"
import type { SqliteDatabase, SqliteReader } from "../database/index.js"
import {
  readAccountKind,
  readInteger,
  readJournalOrigin,
  readString,
  toDisplayMinor,
} from "./sqlite-query-values.js"

const JOURNAL_TYPE_SQL =
  "CASE " +
  "WHEN EXISTS (SELECT 1 FROM postings type_posting " +
  "JOIN ledger_accounts type_account ON type_account.id = type_posting.account_id " +
  "AND type_account.book_id = type_posting.book_id " +
  "WHERE type_posting.book_id = presented.book_id " +
  "AND type_posting.journal_entry_id = presented.presented_entry_id " +
  "AND type_account.system_purpose = 'OPENING_BALANCE') " +
  "THEN 'OPENING_BALANCE' " +
  "WHEN EXISTS (SELECT 1 FROM postings type_posting " +
  "JOIN ledger_accounts type_account ON type_account.id = type_posting.account_id " +
  "AND type_account.book_id = type_posting.book_id " +
  "WHERE type_posting.book_id = presented.book_id " +
  "AND type_posting.journal_entry_id = presented.presented_entry_id " +
  "AND type_account.kind = 'INCOME') " +
  "THEN 'INCOME' " +
  "WHEN EXISTS (SELECT 1 FROM postings type_posting " +
  "JOIN ledger_accounts type_account ON type_account.id = type_posting.account_id " +
  "AND type_account.book_id = type_posting.book_id " +
  "WHERE type_posting.book_id = presented.book_id " +
  "AND type_posting.journal_entry_id = presented.presented_entry_id " +
  "AND type_account.kind = 'EXPENSE') " +
  "THEN 'EXPENSE' " +
  "ELSE 'TRANSFER' END"

export class SqliteJournalViewQueries implements Pick<
  JournalViewQueries,
  "listJournalChains" | "getJournalChainDetail" | "getJournalChainSummary"
> {
  public constructor(private readonly executor: SqliteDatabase) {}

  public async listJournalChains(
    input: ListJournalChainsInput
  ): Promise<QuerySlice<JournalChainListItem, JournalChainCursorKey>> {
    return this.executor.readTransaction(async (reader) => {
      const rows = await this.readPage(reader, input)
      const hasMore = rows.length > input.limit
      const pageRows = hasMore ? rows.slice(0, input.limit) : rows
      const postings = await this.readPostings(
        reader,
        input.bookId,
        pageRows.map((row) =>
          readString(row.presented_entry_id, "presented_entry_id")
        )
      )
      const items = pageRows.map((row) => {
        const entryId = readString(row.presented_entry_id, "presented_entry_id")
        return toChainItem(row, postings.get(entryId) ?? [])
      })
      const last = items.at(-1)
      return {
        items,
        nextKey:
          hasMore && last !== undefined
            ? {
                occurredOn: last.occurredOn,
                sequence: last.sequence,
                chainId: last.chainId,
                filterFingerprint:
                  input.cursor?.filterFingerprint ?? filterFingerprint(input),
              }
            : null,
      }
    })
  }

  public async getJournalChainDetail(
    input: GetJournalChainDetailInput
  ): Promise<JournalChainDetail | null> {
    return this.executor.readTransaction(async (reader) => {
      const historyRows = await this.readDetailHistory(reader, input)
      if (historyRows.length === 0) {
        return null
      }

      const entryIds = historyRows.map((row) =>
        readString(row.presented_entry_id, "entry_id")
      )
      const postings = await this.readPostings(reader, input.bookId, entryIds)
      const businessRows = historyRows.filter(
        (row) => readHistoryRole(row.role) !== "REVERSAL"
      )
      const presentedRow = businessRows.find(
        (row) => row.replaced_by_id === null
      )
      if (presentedRow === undefined) {
        throw new TypeError("Missing effective journal chain entry")
      }

      const presentedEntryId = readString(
        presentedRow.presented_entry_id,
        "entry_id"
      )
      return {
        ...toChainItem(presentedRow, postings.get(presentedEntryId) ?? []),
        postings: (postings.get(presentedEntryId) ?? []).map(toPostingView),
        history: historyRows.map((row) => {
          const entryId = readString(row.presented_entry_id, "entry_id")
          return {
            entryId,
            role: readHistoryRole(row.role),
            occurredOn: readString(row.occurred_on, "occurred_on"),
            recordedAt: readString(row.recorded_at, "recorded_at"),
            sequence: readString(row.sequence, "sequence"),
            description: readString(row.description, "description"),
            postings: (postings.get(entryId) ?? []).map(toPostingView),
          } satisfies JournalHistoryItem
        }),
      }
    })
  }

  public async getJournalChainSummary(
    input: GetJournalChainSummaryInput
  ): Promise<JournalChainSummary> {
    return this.executor.readTransaction(async (reader) => {
      const filtered = buildFilteredPresentedQuery(input)
      const rows = await reader.query<JournalChainSummaryRow>(
        "WITH filtered AS (" +
          filtered.sql +
          "), chain_amounts AS (" +
          "SELECT filtered.chain_id, filtered.business_type, " +
          "CASE WHEN filtered.business_type = 'INCOME' THEN " +
          "COALESCE(SUM(CASE WHEN amount_account.kind = 'INCOME' " +
          "THEN -amount_posting.amount_minor ELSE 0 END), 0) " +
          "WHEN filtered.business_type = 'EXPENSE' THEN " +
          "COALESCE(SUM(CASE WHEN amount_account.kind = 'EXPENSE' " +
          "THEN amount_posting.amount_minor ELSE 0 END), 0) " +
          "ELSE COALESCE(MAX(CASE WHEN amount_account.kind IN ('ASSET', 'LIABILITY') " +
          "THEN ABS(amount_posting.amount_minor) ELSE 0 END), 0) END AS amount_minor " +
          "FROM filtered LEFT JOIN postings amount_posting " +
          "ON amount_posting.book_id = filtered.book_id " +
          "AND amount_posting.journal_entry_id = filtered.presented_entry_id " +
          "LEFT JOIN ledger_accounts amount_account " +
          "ON amount_account.book_id = amount_posting.book_id " +
          "AND amount_account.id = amount_posting.account_id " +
          "GROUP BY filtered.chain_id, filtered.business_type" +
          "), totals AS (" +
          "SELECT CAST(COALESCE(SUM(CASE WHEN business_type = 'INCOME' " +
          "THEN amount_minor ELSE 0 END), 0) AS TEXT) AS income_minor, " +
          "CAST(COALESCE(SUM(CASE WHEN business_type = 'EXPENSE' " +
          "THEN amount_minor ELSE 0 END), 0) AS TEXT) AS expense_minor, " +
          "CAST(COALESCE(MAX(amount_minor), 0) AS TEXT) AS largest_transaction_minor, " +
          "COUNT(*) AS transaction_count FROM chain_amounts" +
          ") SELECT books.base_currency, totals.income_minor, totals.expense_minor, " +
          "totals.largest_transaction_minor, totals.transaction_count " +
          "FROM financial_books books CROSS JOIN totals WHERE books.id = ?",
        [...filtered.parameters, input.bookId]
      )
      const row = rows[0]
      if (row === undefined) {
        throw new TypeError("Missing journal chain summary book")
      }
      return {
        incomeMinor: readString(row.income_minor, "income_minor"),
        expenseMinor: readString(row.expense_minor, "expense_minor"),
        largestTransactionMinor: readString(
          row.largest_transaction_minor,
          "largest_transaction_minor"
        ),
        transactionCount: readInteger(
          row.transaction_count,
          "transaction_count"
        ),
        currency: readString(row.base_currency, "base_currency"),
      }
    })
  }

  private async readPage(
    reader: SqliteReader,
    input: ListJournalChainsInput
  ): Promise<readonly JournalChainPageRow[]> {
    const filtered = buildFilteredPresentedQuery(input)
    const parameters = [...filtered.parameters]
    let sql = filtered.sql
    if (input.cursor !== undefined) {
      sql +=
        " AND (presented.occurred_on < ? OR (presented.occurred_on = ? AND (" +
        "length(presented.sequence) < length(?) OR " +
        "(length(presented.sequence) = length(?) AND (" +
        "presented.sequence < ? OR (presented.sequence = ? AND presented.chain_id < ?))))))"
      parameters.push(
        input.cursor.occurredOn,
        input.cursor.occurredOn,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.sequence,
        input.cursor.chainId
      )
    }

    sql +=
      " ORDER BY presented.occurred_on DESC, length(presented.sequence) DESC, " +
      "presented.sequence DESC, presented.chain_id DESC LIMIT ?"
    parameters.push(input.limit + 1)
    return reader.query<JournalChainPageRow>(sql, parameters)
  }

  private async readPostings(
    reader: SqliteReader,
    bookId: ListJournalChainsInput["bookId"],
    entryIds: readonly string[]
  ): Promise<ReadonlyMap<string, readonly JournalChainPostingRow[]>> {
    const rows =
      entryIds.length === 0
        ? await reader.query<JournalChainPostingRow>(
            "SELECT p.journal_entry_id AS entry_id, p.id AS posting_id, " +
              "p.amount_minor, p.currency, p.position, a.id AS account_id, " +
              "a.name AS account_name, a.kind AS account_kind, a.system_purpose " +
              "FROM postings p JOIN ledger_accounts a ON a.id = p.account_id " +
              "AND a.book_id = p.book_id WHERE 1 = 0"
          )
        : await reader.query<JournalChainPostingRow>(
            "SELECT p.journal_entry_id AS entry_id, p.id AS posting_id, " +
              "CAST(p.amount_minor AS TEXT) AS amount_minor, p.currency, p.position, " +
              "a.id AS account_id, a.name AS account_name, a.kind AS account_kind, " +
              "a.system_purpose " +
              "FROM postings p JOIN ledger_accounts a ON a.id = p.account_id " +
              "AND a.book_id = p.book_id WHERE p.book_id = ? " +
              `AND p.journal_entry_id IN (${entryIds.map(() => "?").join(", ")}) ` +
              "ORDER BY p.journal_entry_id ASC, p.position ASC",
            [bookId, ...entryIds]
          )
    const grouped = new Map<string, JournalChainPostingRow[]>()
    for (const row of rows) {
      const entryId = readString(row.entry_id, "entry_id")
      const current = grouped.get(entryId) ?? []
      current.push(row)
      grouped.set(entryId, current)
    }
    return grouped
  }

  private async readDetailHistory(
    reader: SqliteReader,
    input: GetJournalChainDetailInput
  ): Promise<readonly JournalDetailHistoryRow[]> {
    return reader.query<JournalDetailHistoryRow>(
      "WITH RECURSIVE ancestors(entry_id) AS (" +
        "SELECT id FROM journal_entries WHERE book_id = ? AND id = ? " +
        "UNION " +
        "SELECT entry.replacement_of_id FROM journal_entries entry " +
        "JOIN ancestors ancestor ON ancestor.entry_id = entry.id " +
        "WHERE entry.book_id = ? AND entry.replacement_of_id IS NOT NULL " +
        "UNION " +
        "SELECT entry.reversal_of_id FROM journal_entries entry " +
        "JOIN ancestors ancestor ON ancestor.entry_id = entry.id " +
        "WHERE entry.book_id = ? AND entry.reversal_of_id IS NOT NULL" +
        "), roots(root_id, book_id) AS (" +
        "SELECT entry.id, entry.book_id FROM journal_entries entry " +
        "JOIN ancestors ancestor ON ancestor.entry_id = entry.id " +
        "WHERE entry.book_id = ? AND entry.reversal_of_id IS NULL " +
        "AND entry.replacement_of_id IS NULL" +
        "), business(root_id, book_id, entry_id, role) AS (" +
        "SELECT root_id, book_id, root_id, 'ORIGINAL' FROM roots " +
        "UNION ALL " +
        "SELECT business.root_id, business.book_id, replacement.id, 'REPLACEMENT' " +
        "FROM business " +
        "JOIN journal_entries current_entry ON current_entry.id = business.entry_id " +
        "AND current_entry.book_id = business.book_id " +
        "JOIN journal_entries replacement ON replacement.id = current_entry.replaced_by_id " +
        "AND replacement.book_id = business.book_id " +
        "WHERE current_entry.replaced_by_id IS NOT NULL" +
        "), history AS (" +
        "SELECT business.root_id, business.book_id, business.entry_id, business.role " +
        "FROM business " +
        "UNION ALL " +
        "SELECT business.root_id, business.book_id, reversal.id, 'REVERSAL' " +
        "FROM business " +
        "JOIN journal_entries reversal ON reversal.reversal_of_id = business.entry_id " +
        "AND reversal.book_id = business.book_id" +
        ") SELECT history.root_id AS chain_id, entry.id AS presented_entry_id, " +
        "entry.version AS presented_version, entry.occurred_on, entry.recorded_at, " +
        "CAST(entry.sequence AS TEXT) AS sequence, entry.description, entry.origin, " +
        "entry.currency, history.role, entry.replacement_of_id, entry.replaced_by_id, " +
        "entry.reversed_by_id, CASE WHEN entry.reversed_by_id IS NOT NULL THEN 'CANCELLED' " +
        "WHEN entry.replacement_of_id IS NOT NULL THEN 'EDITED' ELSE 'ACTIVE' END AS status, " +
        `${JOURNAL_TYPE_SQL.replaceAll(
          "presented.presented_entry_id",
          "entry.id"
        ).replaceAll("presented.", "entry.")} AS business_type ` +
        "FROM history JOIN journal_entries entry ON entry.id = history.entry_id " +
        "AND entry.book_id = history.book_id " +
        "ORDER BY entry.recorded_at ASC, length(CAST(entry.sequence AS TEXT)) ASC, " +
        "CAST(entry.sequence AS TEXT) ASC, entry.id ASC",
      [input.bookId, input.entryId, input.bookId, input.bookId, input.bookId]
    )
  }
}

type FilteredPresentedInput = Omit<GetJournalChainSummaryInput, "status"> & {
  readonly status?: JournalChainStatus
}

function buildFilteredPresentedQuery(input: FilteredPresentedInput): {
  readonly sql: string
  readonly parameters: readonly (string | number)[]
} {
  const parameters: (string | number)[] = [input.bookId, input.bookId]
  let sql =
    "WITH RECURSIVE chain(root_id, entry_id) AS (" +
    "SELECT e.id, e.id FROM journal_entries e " +
    "WHERE e.book_id = ? AND e.reversal_of_id IS NULL AND e.replacement_of_id IS NULL " +
    "UNION ALL " +
    "SELECT chain.root_id, next_entry.id FROM chain " +
    "JOIN journal_entries current_entry ON current_entry.id = chain.entry_id " +
    "JOIN journal_entries next_entry ON next_entry.id = current_entry.replaced_by_id " +
    "AND next_entry.book_id = current_entry.book_id " +
    "WHERE current_entry.replaced_by_id IS NOT NULL" +
    "), presented AS (" +
    "SELECT chain.root_id AS chain_id, e.id AS presented_entry_id, " +
    "e.book_id, e.occurred_on, e.recorded_at, CAST(e.sequence AS TEXT) AS sequence, " +
    "e.description, e.origin, e.currency, e.version AS presented_version, " +
    "e.replacement_of_id, e.reversed_by_id " +
    "FROM chain JOIN journal_entries e ON e.id = chain.entry_id " +
    "AND e.book_id = ? WHERE e.replaced_by_id IS NULL" +
    ") SELECT presented.chain_id, presented.presented_entry_id, presented.book_id, " +
    "presented.presented_version, presented.occurred_on, presented.recorded_at, " +
    "presented.sequence, presented.description, presented.origin, presented.currency, " +
    `${JOURNAL_STATUS_SQL} AS status, ${JOURNAL_TYPE_SQL} AS business_type ` +
    "FROM presented JOIN journal_entries presented_search " +
    "ON presented_search.id = presented.presented_entry_id " +
    "AND presented_search.book_id = presented.book_id WHERE 1 = 1"

  if (input.from !== undefined) {
    sql += " AND presented.occurred_on >= ?"
    parameters.push(input.from.value)
  }
  if (input.to !== undefined) {
    sql += " AND presented.occurred_on <= ?"
    parameters.push(input.to.value)
  }
  if (input.accountIds !== undefined) {
    sql +=
      " AND EXISTS (SELECT 1 FROM postings account_filter " +
      "JOIN ledger_accounts account_filter_account ON account_filter_account.id = account_filter.account_id " +
      "AND account_filter_account.book_id = account_filter.book_id " +
      "WHERE account_filter.book_id = presented.book_id " +
      "AND account_filter.journal_entry_id = presented.presented_entry_id " +
      "AND account_filter_account.kind IN ('ASSET', 'LIABILITY') " +
      `AND account_filter.account_id IN (${input.accountIds.map(() => "?").join(", ")}))`
    parameters.push(...input.accountIds)
  }
  if (input.categoryIds !== undefined) {
    sql +=
      " AND EXISTS (SELECT 1 FROM postings category_filter " +
      "JOIN ledger_accounts category_filter_account ON category_filter_account.id = category_filter.account_id " +
      "AND category_filter_account.book_id = category_filter.book_id " +
      "WHERE category_filter.book_id = presented.book_id " +
      "AND category_filter.journal_entry_id = presented.presented_entry_id " +
      "AND category_filter_account.kind IN ('INCOME', 'EXPENSE') " +
      `AND category_filter.account_id IN (${input.categoryIds.map(() => "?").join(", ")}))`
    parameters.push(...input.categoryIds)
  }
  if (input.types !== undefined) {
    sql += ` AND (${JOURNAL_TYPE_SQL}) IN (${input.types.map(() => "?").join(", ")})`
    parameters.push(...input.types)
  }
  if (input.origins !== undefined) {
    sql += ` AND presented.origin IN (${input.origins.map(() => "?").join(", ")})`
    parameters.push(...input.origins)
  }
  if (input.search !== undefined) {
    sql += " AND instr(presented_search.search_text, ?) > 0"
    parameters.push(input.search)
  }
  if (input.status !== undefined) {
    sql += ` AND (${JOURNAL_STATUS_SQL}) = ?`
    parameters.push(input.status)
  }

  return { sql, parameters }
}

const JOURNAL_STATUS_SQL =
  "CASE WHEN presented.reversed_by_id IS NOT NULL THEN 'CANCELLED' " +
  "WHEN presented.replacement_of_id IS NOT NULL THEN 'EDITED' ELSE 'ACTIVE' END"

type JournalChainPageRow = {
  readonly chain_id: unknown
  readonly presented_entry_id: unknown
  readonly presented_version: unknown
  readonly occurred_on: unknown
  readonly recorded_at: unknown
  readonly sequence: unknown
  readonly description: unknown
  readonly origin: unknown
  readonly currency: unknown
  readonly status: unknown
  readonly business_type: unknown
}

type JournalChainSummaryRow = {
  readonly income_minor: unknown
  readonly expense_minor: unknown
  readonly largest_transaction_minor: unknown
  readonly transaction_count: unknown
  readonly base_currency: unknown
}

type JournalDetailHistoryRow = JournalChainPageRow & {
  readonly role: unknown
  readonly replaced_by_id: unknown
}

type JournalChainPostingRow = {
  readonly entry_id: unknown
  readonly posting_id: unknown
  readonly amount_minor: unknown
  readonly currency: unknown
  readonly position: unknown
  readonly account_id: unknown
  readonly account_name: unknown
  readonly account_kind: unknown
  readonly system_purpose: unknown
}

function toChainItem(
  row: JournalChainPageRow,
  rows: readonly JournalChainPostingRow[]
): JournalChainListItem {
  const financialAccounts = uniqueAccounts(
    rows.filter((posting) =>
      isFinancialKind(readAccountKind(posting.account_kind))
    )
  )
  const categories = uniqueAccounts(
    rows.filter((posting) =>
      isCategoryKind(readAccountKind(posting.account_kind))
    )
  )
  const type = readBusinessType(row.business_type)
  const transfer =
    type === "TRANSFER" && financialAccounts.length === 2
      ? {
          source:
            accountSummaryForAmount(rows, -1) ??
            (financialAccounts[0] as AccountSummary),
          destination:
            accountSummaryForAmount(rows, 1) ??
            (financialAccounts[1] as AccountSummary),
        }
      : undefined

  return {
    chainId: readString(row.chain_id, "chain_id"),
    presentedEntryId: readString(row.presented_entry_id, "presented_entry_id"),
    presentedVersion: readInteger(row.presented_version, "presented_version"),
    type,
    status: readStatus(row.status),
    occurredOn: readString(row.occurred_on, "occurred_on"),
    recordedAt: readString(row.recorded_at, "recorded_at"),
    sequence: readString(row.sequence, "sequence"),
    description: readString(row.description, "description"),
    origin: readJournalOrigin(row.origin),
    amountMinor: amountFor(type, rows),
    currency: readString(row.currency, "currency"),
    financialAccounts,
    categories,
    ...(transfer === undefined ? {} : { transfer }),
  }
}

type AccountSummary = JournalChainListItem["financialAccounts"][number]

function uniqueAccounts(
  rows: readonly JournalChainPostingRow[]
): readonly AccountSummary[] {
  const accounts = new Map<string, AccountSummary>()
  for (const row of rows) {
    const account = {
      id: readString(row.account_id, "account_id"),
      name: readString(row.account_name, "account_name"),
      kind: readAccountKind(row.account_kind),
    } satisfies AccountSummary
    accounts.set(account.id, account)
  }
  return [...accounts.values()].sort(
    (left, right) =>
      compareText(left.name, right.name) || compareText(left.id, right.id)
  )
}

function accountSummaryForAmount(
  rows: readonly JournalChainPostingRow[],
  sign: -1 | 1
): AccountSummary | undefined {
  return rows
    .filter((row) => isFinancialKind(readAccountKind(row.account_kind)))
    .find((row) => {
      const amount = BigInt(readString(row.amount_minor, "amount_minor"))
      return sign < 0 ? amount < 0n : amount > 0n
    })?.account_id === undefined
    ? undefined
    : toAccountSummary(
        rows.find((row) => {
          const amount = BigInt(readString(row.amount_minor, "amount_minor"))
          return (
            isFinancialKind(readAccountKind(row.account_kind)) &&
            (sign < 0 ? amount < 0n : amount > 0n)
          )
        }) as JournalChainPostingRow
      )
}

function toAccountSummary(row: JournalChainPostingRow): AccountSummary {
  return {
    id: readString(row.account_id, "account_id"),
    name: readString(row.account_name, "account_name"),
    kind: readAccountKind(row.account_kind),
  }
}

function toPostingView(row: JournalChainPostingRow): JournalPostingView {
  return {
    id: readString(row.posting_id, "posting_id"),
    account: toAccountSummary(row),
    amountMinor: readString(row.amount_minor, "amount_minor"),
    currency: readString(row.currency, "currency"),
    position: readInteger(row.position, "position"),
  }
}

function readHistoryRole(value: unknown): JournalHistoryRole {
  if (value === "ORIGINAL" || value === "REVERSAL" || value === "REPLACEMENT") {
    return value
  }

  throw new TypeError("Invalid journal history role")
}

function amountFor(
  type: JournalBusinessType,
  rows: readonly JournalChainPostingRow[]
): string {
  if (type === "INCOME" || type === "EXPENSE") {
    const categoryKind = type
    return rows
      .filter((row) => readAccountKind(row.account_kind) === categoryKind)
      .reduce((total, row) => {
        const amount = BigInt(readString(row.amount_minor, "amount_minor"))
        return total + BigInt(toDisplayMinor(amount, categoryKind))
      }, 0n)
      .toString()
  }

  const financial = rows.find((row) =>
    isFinancialKind(readAccountKind(row.account_kind))
  )
  if (financial === undefined) {
    return "0"
  }
  const amount = BigInt(readString(financial.amount_minor, "amount_minor"))
  return (amount < 0n ? -amount : amount).toString()
}

function filterFingerprint(input: ListJournalChainsInput): string {
  return JSON.stringify({
    from: input.from?.value ?? null,
    to: input.to?.value ?? null,
    accountIds: input.accountIds ?? [],
    categoryIds: input.categoryIds ?? [],
    types: input.types ?? [],
    origins: input.origins ?? [],
    search: input.search ?? null,
  })
}

function isFinancialKind(kind: LedgerAccountKind): boolean {
  return kind === "ASSET" || kind === "LIABILITY"
}

function isCategoryKind(kind: LedgerAccountKind): boolean {
  return kind === "INCOME" || kind === "EXPENSE"
}

function readBusinessType(value: unknown): JournalBusinessType {
  if (
    value === "OPENING_BALANCE" ||
    value === "INCOME" ||
    value === "EXPENSE" ||
    value === "TRANSFER"
  ) {
    return value
  }
  throw new TypeError("Invalid journal business type")
}

function readStatus(value: unknown): JournalChainStatus {
  if (value === "ACTIVE" || value === "EDITED" || value === "CANCELLED") {
    return value
  }
  throw new TypeError("Invalid journal chain status")
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
