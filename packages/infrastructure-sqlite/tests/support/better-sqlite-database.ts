import Database from "better-sqlite3"
import type {
  SqliteDatabase,
  SqliteExecutionResult,
  SqliteExecutor,
  SqliteParameters,
  SqliteReader,
  SqliteValue,
} from "../../src/database/index.js"

type Connection = Database.Database

function lifecycleError(): Error {
  return new Error("SQLite database is closed")
}

function bindStatement(
  statement: Database.Statement,
  parameters?: SqliteParameters
) {
  if (parameters === undefined) {
    return statement
  }

  if (Array.isArray(parameters)) {
    return statement.bind(...([...parameters] as SqliteValue[]))
  }

  return statement.bind(parameters)
}

class ScopedReader implements SqliteReader {
  private active = true

  public constructor(private readonly database: BetterSqliteDatabase) {}

  public invalidate(): void {
    this.active = false
  }

  public async query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<Row[]> {
    this.assertActive()
    return this.database.queryOnConnection<Row>(sql, parameters)
  }

  protected assertActive(): void {
    if (!this.active) {
      throw new Error("SQLite transaction executor is no longer active")
    }
  }
}

class ScopedExecutor extends ScopedReader implements SqliteExecutor {
  public async execute(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<SqliteExecutionResult> {
    this.assertActive()
    return this.database.executeOnConnection(sql, parameters)
  }

  public async executeBatch(sql: string): Promise<void> {
    this.assertActive()
    this.database.executeBatchOnConnection(sql)
  }
}

export class BetterSqliteDatabase implements SqliteDatabase {
  private queue: Promise<unknown> = Promise.resolve()
  private closing = false
  private closed = false
  private closePromise: Promise<void> | undefined

  private readonly connection: Connection

  public constructor(
    filenameOrConnection: string | Connection = ":memory:",
    options?: Database.Options
  ) {
    this.connection =
      typeof filenameOrConnection === "string"
        ? new Database(filenameOrConnection, options)
        : filenameOrConnection
  }

  public execute(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<SqliteExecutionResult> {
    return this.enqueue(() => this.executeOnConnection(sql, parameters))
  }

  public query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<Row[]> {
    return this.enqueue(() => this.queryOnConnection<Row>(sql, parameters))
  }

  public executeBatch(sql: string): Promise<void> {
    return this.enqueue(() => this.executeBatchOnConnection(sql))
  }

  public transaction<T>(
    work: (transaction: SqliteExecutor) => Promise<T>
  ): Promise<T> {
    return this.enqueue(async () => {
      this.connection.exec("BEGIN IMMEDIATE")
      const scopedExecutor = new ScopedExecutor(this)

      try {
        const result = await work(scopedExecutor)
        this.connection.exec("COMMIT")
        return result
      } catch (error) {
        this.rollbackIfActive()
        throw error
      } finally {
        scopedExecutor.invalidate()
      }
    })
  }

  public readTransaction<T>(
    work: (reader: SqliteReader) => Promise<T>
  ): Promise<T> {
    return this.enqueue(async () => {
      this.connection.exec("BEGIN")
      const reader = new ScopedReader(this)

      try {
        const result = await work(reader)
        this.connection.exec("COMMIT")
        return result
      } catch (error) {
        this.rollbackIfActive()
        throw error
      } finally {
        reader.invalidate()
      }
    })
  }

  public close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise
    }

    this.closing = true
    this.closePromise = this.enqueue(() => {
      if (!this.closed) {
        this.connection.close()
        this.closed = true
      }
    }, true)
    return this.closePromise
  }

  public get isTransactionActive(): boolean {
    return this.connection.inTransaction
  }

  public executeOnConnection(
    sql: string,
    parameters?: SqliteParameters
  ): SqliteExecutionResult {
    const statement = bindStatement(this.connection.prepare(sql), parameters)
    const result = statement.safeIntegers().run()

    return {
      rowsAffected: Number(result.changes),
      lastInsertRowId: String(result.lastInsertRowid),
    }
  }

  public queryOnConnection<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters
  ): Row[] {
    const statement = bindStatement(this.connection.prepare(sql), parameters)
    return statement.all() as Row[]
  }

  public executeBatchOnConnection(sql: string): void {
    this.connection.exec(sql)
  }

  private enqueue<T>(
    operation: () => T | PromiseLike<T>,
    allowClosing = false
  ): Promise<T> {
    if (!allowClosing && (this.closing || this.closed)) {
      return Promise.reject(lifecycleError())
    }

    const result = this.queue.then(operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private rollbackIfActive(): void {
    if (this.connection.inTransaction) {
      try {
        this.connection.exec("ROLLBACK")
      } catch {
        // Preserve the callback or commit error that caused the rollback.
      }
    }
  }
}
