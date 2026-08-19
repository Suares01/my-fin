import type { SqliteReader } from "./sqlite-executor.js"

export const SQLITE_PRAGMA_MISMATCH = "SQLITE_PRAGMA_MISMATCH" as const

export class SqlitePragmaVerificationError extends Error {
  public readonly code = SQLITE_PRAGMA_MISMATCH

  public constructor() {
    super("SQLite connection pragmas failed verification")
    this.name = "SqlitePragmaVerificationError"
  }
}

type PragmaCheck = {
  readonly statement: string
  readonly column: string
  readonly expected: number | string
}

export type SqlitePragmaVerificationOptions = {
  readonly inMemory: boolean
}

export async function verifySqliteConnection(
  reader: SqliteReader,
  options: SqlitePragmaVerificationOptions
): Promise<void> {
  const checks: PragmaCheck[] = [
    { statement: "PRAGMA foreign_keys", column: "foreign_keys", expected: 1 },
    { statement: "PRAGMA busy_timeout", column: "timeout", expected: 5000 },
  ]

  if (!options.inMemory) {
    checks.push(
      {
        statement: "PRAGMA journal_mode",
        column: "journal_mode",
        expected: "wal",
      },
      { statement: "PRAGMA synchronous", column: "synchronous", expected: 2 }
    )
  }

  try {
    for (const check of checks) {
      const [row] = await reader.query<Record<string, unknown>>(check.statement)
      const actual = row?.[check.column]
      const matches = matchesPragmaValue(actual, check.expected)

      if (!matches) {
        throw new SqlitePragmaVerificationError()
      }
    }
  } catch (error) {
    if (error instanceof SqlitePragmaVerificationError) {
      throw error
    }

    throw new SqlitePragmaVerificationError()
  }
}

function matchesPragmaValue(
  actual: unknown,
  expected: number | string
): boolean {
  if (typeof expected === "string") {
    return typeof actual === "string" && actual.toLowerCase() === expected
  }

  return actual === expected || actual === String(expected)
}
