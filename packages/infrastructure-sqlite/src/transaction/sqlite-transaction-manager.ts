import {
  type RepositoryContext,
  type TransactionManager,
} from "@workspace/application"
import type { DomainFact } from "@workspace/domain"
import type { SqliteDatabase } from "../database/sqlite-database.js"
import { mapSqliteError } from "../database/sqlite-error.js"
import { createSqliteRepositoryContext } from "../repositories/create-sqlite-repository-context.js"
import { SqliteFactCollector } from "../repositories/sqlite-fact-collector.js"

export class SqliteTransactionManager implements TransactionManager {
  public constructor(private readonly database: SqliteDatabase) {}

  public async execute<T>(
    work: (repositories: RepositoryContext) => Promise<T>
  ): Promise<{ readonly value: T; readonly facts: readonly DomainFact[] }> {
    let facts: SqliteFactCollector | undefined

    try {
      const value = await this.database.transaction(async (executor) => {
        facts = new SqliteFactCollector()
        return work(createSqliteRepositoryContext(executor, facts))
      })

      return {
        value,
        facts: facts?.pull() ?? [],
      }
    } catch (error) {
      if (isSqliteDriverError(error)) {
        throw mapSqliteError(error)
      }

      throw error
    }
  }
}

function isSqliteDriverError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const candidate = error as {
    readonly code?: unknown
    readonly errno?: unknown
    readonly extendedCode?: unknown
  }

  return (
    (typeof candidate.code === "string" &&
      candidate.code.startsWith("SQLITE_")) ||
    typeof candidate.errno === "number" ||
    typeof candidate.extendedCode === "number"
  )
}
