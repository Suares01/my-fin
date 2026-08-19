import {
  ApplicationError,
  type DomainFactCollector,
  type JournalEntryRepository,
} from "@workspace/application"
import {
  JournalEntry,
  type BookId,
  type JournalEntryId,
  type LedgerAccountId,
} from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import {
  assertSqliteSequence,
  mapSqliteError,
} from "../database/sqlite-error.js"
import {
  JournalEntryMapper,
  type JournalEntryRow,
} from "../mappers/journal-entry-mapper.js"

const JOURNAL_ENTRY_SELECT =
  "SELECT e.id, e.book_id, e.occurred_on, e.recorded_at, e.sequence, " +
  "e.description, e.currency, e.origin, e.reversal_of_id, " +
  "e.reversed_by_id, e.replacement_of_id, e.replaced_by_id, " +
  "e.search_text, e.search_version, e.version, p.id AS posting_id, " +
  "p.book_id AS posting_book_id, p.journal_entry_id AS posting_journal_entry_id, " +
  "p.account_id AS posting_account_id, p.position AS posting_position, " +
  "CAST(p.amount_minor AS TEXT) AS posting_amount_minor, " +
  "p.currency AS posting_currency " +
  "FROM journal_entries e JOIN postings p " +
  "ON p.journal_entry_id = e.id AND p.book_id = e.book_id "

export class SqliteJournalEntryRepository implements JournalEntryRepository {
  public constructor(
    private readonly executor: SqliteExecutor,
    private readonly facts?: DomainFactCollector
  ) {}

  public async findById(id: JournalEntryId): Promise<JournalEntry | null> {
    const rows = await this.executor.query<JournalEntryRow>(
      JOURNAL_ENTRY_SELECT + "WHERE e.id = ? ORDER BY p.position",
      [id]
    )
    return rows.length === 0 ? null : JournalEntryMapper.toDomain(rows)
  }

  public async findActiveOpeningBalanceByAccount(
    bookId: BookId,
    accountId: LedgerAccountId
  ): Promise<JournalEntry | null> {
    const rows = await this.executor.query<JournalEntryRow>(
      JOURNAL_ENTRY_SELECT +
        "WHERE e.book_id = ? " +
        "AND EXISTS (SELECT 1 FROM postings target " +
        "JOIN postings opening_posting ON opening_posting.journal_entry_id = target.journal_entry_id " +
        "AND opening_posting.book_id = target.book_id " +
        "JOIN ledger_accounts opening ON opening.id = opening_posting.account_id " +
        "AND opening.book_id = opening_posting.book_id " +
        "WHERE target.journal_entry_id = e.id " +
        "AND target.book_id = e.book_id AND target.account_id = ? " +
        "AND opening.system_purpose = 'OPENING_BALANCE') " +
        "AND e.reversal_of_id IS NULL AND e.reversed_by_id IS NULL " +
        "AND e.replaced_by_id IS NULL " +
        "ORDER BY p.position",
      [bookId, accountId]
    )
    return rows.length === 0 ? null : JournalEntryMapper.toDomain(rows)
  }

  public async reserveNextSequence(bookId: BookId): Promise<string> {
    try {
      const rows = await this.executor.query<{ readonly sequence: unknown }>(
        "INSERT INTO journal_sequences (book_id, last_sequence) VALUES (?, 1) " +
          "ON CONFLICT(book_id) DO UPDATE SET last_sequence = last_sequence + 1 " +
          "WHERE last_sequence < 9223372036854775807 " +
          "RETURNING CAST(last_sequence AS TEXT) AS sequence",
        [bookId]
      )
      const sequence = rows[0]?.sequence
      if (typeof sequence !== "string") {
        throw new ApplicationError(
          "UNEXPECTED_ERROR",
          "Journal sequence is outside the supported SQLite range"
        )
      }

      assertSqliteSequence(BigInt(sequence))
      return sequence
    } catch (error) {
      throw mapSqliteError(error)
    }
  }

  public async add(entry: JournalEntry): Promise<void> {
    if (entry.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new journal entry must start at version zero"
      )
    }

    const values = JournalEntryMapper.toPersistence(entry)
    try {
      await this.executor.execute(
        "INSERT INTO journal_entries " +
          "(id, book_id, occurred_on, recorded_at, sequence, description, " +
          "currency, origin, reversal_of_id, reversed_by_id, " +
          "replacement_of_id, replaced_by_id, search_text, search_version, version) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          values.entry.id,
          values.entry.book_id,
          values.entry.occurred_on,
          values.entry.recorded_at,
          values.entry.sequence,
          values.entry.description,
          values.entry.currency,
          values.entry.origin,
          values.entry.reversal_of_id,
          values.entry.reversed_by_id,
          values.entry.replacement_of_id,
          values.entry.replaced_by_id,
          values.entry.search_text,
          values.entry.search_version,
          values.entry.version,
        ]
      )

      for (const posting of values.postings) {
        await this.executor.execute(
          "INSERT INTO postings " +
            "(id, book_id, journal_entry_id, account_id, position, " +
            "amount_minor, currency) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            posting.id,
            posting.book_id,
            posting.journal_entry_id,
            posting.account_id,
            posting.position,
            posting.amount_minor,
            posting.currency,
          ]
        )
      }
    } catch (error) {
      throw mapSqliteError(error)
    }

    this.facts?.record(entry.pullDomainFacts())
  }

  public async save(
    entry: JournalEntry,
    expectedVersion: number
  ): Promise<void> {
    if (entry.version !== expectedVersion + 1) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Journal entry ${entry.id} has a conflicting version`
      )
    }

    let result
    try {
      result = await this.executor.execute(
        "UPDATE journal_entries SET reversed_by_id = ?, replaced_by_id = ?, version = ? " +
          "WHERE id = ? AND version = ?",
        [
          entry.reversedBy ?? null,
          entry.replacedBy ?? null,
          entry.version,
          entry.id,
          expectedVersion,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }

    if (result.rowsAffected === 0) {
      const persisted = await this.findById(entry.id)
      if (persisted === null) {
        throw new ApplicationError(
          "ENTITY_NOT_FOUND",
          `Journal entry ${entry.id} was not found`
        )
      }

      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Journal entry ${entry.id} has a conflicting version`
      )
    }

    this.facts?.record(entry.pullDomainFacts())
  }
}
