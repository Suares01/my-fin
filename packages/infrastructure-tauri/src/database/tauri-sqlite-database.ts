import { invoke as tauriInvoke } from "@tauri-apps/api/core"
import type {
  SqliteDatabase,
  SqliteExecutionResult,
  SqliteExecutor,
  SqliteParameters,
  SqliteReader,
} from "@workspace/infrastructure-sqlite"

import {
  decodeIpcError,
  decodeIpcExecutionResult,
  decodeIpcRows,
  encodeSqliteParameters,
  TauriDatabaseError,
} from "./protocol.js"
import type { IpcRow } from "./protocol.js"

export type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>
) => Promise<T>

export type TauriSqliteDatabaseOptions = {
  readonly invoke?: TauriInvoke
  readonly vaultName?: string
}

type DatabasePhase = "new" | "open" | "closing" | "closed"

const APPROVED_VAULT_NAME = "my-fin.sqlite"

function lifecycleError(code: string, message: string): TauriDatabaseError {
  return new TauriDatabaseError({
    code,
    diagnosticId: `adapter-${code.toLowerCase()}`,
    message,
  })
}

class ScopedReader implements SqliteReader {
  private active = true

  public constructor(
    private readonly queryOperation: <Row extends Record<string, unknown>>(
      sql: string,
      parameters: SqliteParameters | undefined
    ) => Promise<Row[]>
  ) {}

  public invalidate(): void {
    this.active = false
  }

  public async query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<Row[]> {
    this.assertActive()
    return this.queryOperation<Row>(sql, parameters)
  }

  protected assertActive(): void {
    if (!this.active) {
      throw lifecycleError(
        "TRANSACTION_SCOPE_CLOSED",
        "SQLite transaction scope is no longer active"
      )
    }
  }
}

class ScopedExecutor extends ScopedReader implements SqliteExecutor {
  public constructor(
    queryOperation: <Row extends Record<string, unknown>>(
      sql: string,
      parameters: SqliteParameters | undefined
    ) => Promise<Row[]>,
    private readonly executeOperation: (
      sql: string,
      parameters: SqliteParameters | undefined
    ) => Promise<SqliteExecutionResult>,
    private readonly batchOperation: (sql: string) => Promise<void>
  ) {
    super(queryOperation)
  }

  public async execute(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<SqliteExecutionResult> {
    this.assertActive()
    return this.executeOperation(sql, parameters)
  }

  public async executeBatch(sql: string): Promise<void> {
    this.assertActive()
    return this.batchOperation(sql)
  }
}

export class TauriSqliteDatabase implements SqliteDatabase {
  private readonly invoke: TauriInvoke
  private readonly vaultName: string
  private queue: Promise<void> = Promise.resolve()
  private phase: DatabasePhase = "new"
  private closePromise: Promise<void> | undefined

  public constructor(options: TauriSqliteDatabaseOptions = {}) {
    this.invoke = options.invoke ?? (tauriInvoke as TauriInvoke)
    this.vaultName = options.vaultName ?? APPROVED_VAULT_NAME
  }

  public open(options: { readonly vaultName?: string } = {}): Promise<void> {
    if (this.phase === "open") {
      return Promise.resolve()
    }
    if (this.phase !== "new") {
      return Promise.reject(
        lifecycleError("DATABASE_CLOSED", "Database actor is closed")
      )
    }

    const vaultName = options.vaultName ?? this.vaultName
    const operation = this.queue.then(async () => {
      try {
        await this.invoke("database_open", {
          request: { vaultName },
        })
        this.phase = "open"
      } catch (error) {
        throw decodeIpcError(error)
      }
    })
    this.remember(operation)
    return operation
  }

  public execute(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<SqliteExecutionResult> {
    return this.enqueue(() => this.executeDirect(sql, parameters))
  }

  public query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters
  ): Promise<Row[]> {
    return this.enqueue(() => this.queryDirect<Row>(sql, parameters))
  }

  public executeBatch(sql: string): Promise<void> {
    return this.enqueue(() => this.executeBatchDirect(sql))
  }

  public transaction<T>(
    work: (transaction: SqliteExecutor) => Promise<T>
  ): Promise<T> {
    return this.enqueue(() =>
      this.runTransaction(
        "write",
        work as (scope: SqliteExecutor | SqliteReader) => Promise<T>
      )
    )
  }

  public readTransaction<T>(
    work: (reader: SqliteReader) => Promise<T>
  ): Promise<T> {
    return this.enqueue(() =>
      this.runTransaction(
        "read",
        work as (scope: SqliteExecutor | SqliteReader) => Promise<T>
      )
    )
  }

  public health(): Promise<void> {
    return this.enqueue(async () => {
      try {
        await this.invoke("database_health")
      } catch (error) {
        throw decodeIpcError(error)
      }
    })
  }

  public close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise
    }
    if (this.phase === "closed") {
      return Promise.resolve()
    }
    if (this.phase === "new") {
      this.phase = "closed"
      return Promise.resolve()
    }

    this.phase = "closing"
    const operation = this.queue.then(async () => {
      try {
        await this.invoke("database_close")
        this.phase = "closed"
      } catch (error) {
        this.phase = "closed"
        throw decodeIpcError(error)
      }
    })
    this.closePromise = operation
    this.remember(operation)
    return operation
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.phase !== "open") {
      return Promise.reject(
        lifecycleError("DATABASE_NOT_OPEN", "Database is not open")
      )
    }
    const next = this.queue.then(operation)
    this.remember(next)
    return next
  }

  private remember<T>(operation: Promise<T>): void {
    this.queue = operation.then(
      () => undefined,
      () => undefined
    )
  }

  private async executeDirect(
    sql: string,
    parameters?: SqliteParameters,
    transactionId?: string
  ): Promise<SqliteExecutionResult> {
    try {
      const result = await this.invoke<unknown>("database_execute", {
        request: {
          sql,
          parameters: encodeSqliteParameters(parameters),
          ...(transactionId === undefined ? {} : { transactionId }),
        },
      })
      return decodeIpcExecutionResult(result)
    } catch (error) {
      throw decodeIpcError(error)
    }
  }

  private async queryDirect<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: SqliteParameters,
    transactionId?: string
  ): Promise<Row[]> {
    try {
      const rows = await this.invoke<unknown>("database_query", {
        request: {
          sql,
          parameters: encodeSqliteParameters(parameters),
          ...(transactionId === undefined ? {} : { transactionId }),
        },
      })
      return decodeIpcRows(rows) as Row[]
    } catch (error) {
      throw decodeIpcError(error)
    }
  }

  private async executeBatchDirect(
    sql: string,
    transactionId?: string
  ): Promise<void> {
    try {
      await this.invoke("database_execute_batch", {
        request: {
          sql,
          ...(transactionId === undefined ? {} : { transactionId }),
        },
      })
    } catch (error) {
      throw decodeIpcError(error)
    }
  }

  private async runTransaction<T>(
    mode: "write" | "read",
    work: (scope: SqliteExecutor | SqliteReader) => Promise<T>
  ): Promise<T> {
    const transactionId = await this.invokeSafe<string>(
      "database_begin_transaction",
      {
        request: { mode },
      }
    )
    const scopedReader = new ScopedReader((sql, parameters) =>
      this.queryDirect(sql, parameters, transactionId)
    )
    const scope =
      mode === "write"
        ? new ScopedExecutor(
            (sql, parameters) =>
              this.queryDirect(sql, parameters, transactionId),
            (sql, parameters) =>
              this.executeDirect(sql, parameters, transactionId),
            (sql) => this.executeBatchDirect(sql, transactionId)
          )
        : scopedReader

    try {
      const result = await work(scope)
      await this.invokeSafe("database_commit_transaction", {
        request: { transactionId },
      })
      return result
    } catch (error) {
      try {
        await this.invokeSafe("database_rollback_transaction", {
          request: { transactionId },
        })
      } catch {
        // Preserve the callback or commit failure as the useful cause.
      }
      throw error
    } finally {
      scope.invalidate()
    }
  }

  private async invokeSafe<T>(
    command: string,
    args?: Record<string, unknown>
  ): Promise<T> {
    try {
      return await this.invoke<T>(command, args)
    } catch (error) {
      throw decodeIpcError(error)
    }
  }
}

export type { IpcRow }
