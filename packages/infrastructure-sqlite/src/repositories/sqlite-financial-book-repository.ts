import {
  ApplicationError,
  type DomainFactCollector,
  type FinancialBookRepository,
} from "@workspace/application"
import { FinancialBook, type BookId } from "@workspace/domain"
import type { SqliteExecutor } from "../database/sqlite-executor.js"
import { mapSqliteError } from "../database/sqlite-error.js"
import {
  FinancialBookMapper,
  type FinancialBookRow,
} from "../mappers/financial-book-mapper.js"

export class SqliteFinancialBookRepository implements FinancialBookRepository {
  public constructor(
    private readonly executor: SqliteExecutor,
    private readonly facts?: DomainFactCollector
  ) {}

  public async findById(id: BookId): Promise<FinancialBook | null> {
    const rows = await this.executor.query<FinancialBookRow>(
      "SELECT id, name, base_currency, timezone, version " +
        "FROM financial_books WHERE id = ?",
      [id]
    )
    const row = rows[0]
    return row === undefined ? null : FinancialBookMapper.toDomain(row)
  }

  public async add(book: FinancialBook): Promise<void> {
    if (book.version !== 0) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        "A new financial book must start at version zero"
      )
    }

    const values = FinancialBookMapper.toPersistence(book)
    try {
      await this.executor.execute(
        "INSERT INTO financial_books " +
          "(id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
        [
          values.id,
          values.name,
          values.base_currency,
          values.timezone,
          values.version,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }

    this.facts?.record(book.pullDomainFacts())
  }

  public async save(
    book: FinancialBook,
    expectedVersion: number
  ): Promise<void> {
    if (book.version !== expectedVersion + 1) {
      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Financial book ${book.id} has a conflicting version`
      )
    }

    const values = FinancialBookMapper.toPersistence(book)
    let result
    try {
      result = await this.executor.execute(
        "UPDATE financial_books SET name = ?, base_currency = ?, " +
          "timezone = ?, version = ? WHERE id = ? AND version = ?",
        [
          values.name,
          values.base_currency,
          values.timezone,
          values.version,
          values.id,
          expectedVersion,
        ]
      )
    } catch (error) {
      throw mapSqliteError(error)
    }

    if (result.rowsAffected === 0) {
      const persisted = await this.findById(book.id)
      if (persisted === null) {
        throw new ApplicationError(
          "ENTITY_NOT_FOUND",
          `Financial book ${book.id} was not found`
        )
      }

      throw new ApplicationError(
        "OPTIMISTIC_CONCURRENCY_FAILURE",
        `Financial book ${book.id} has a conflicting version`
      )
    }

    this.facts?.record(book.pullDomainFacts())
  }
}
