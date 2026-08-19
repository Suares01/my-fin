import type { SqliteDatabase } from "../database/sqlite-database.js"
import {
  InvalidMigrationPlanError,
  ModifiedMigrationError,
  UnknownAppliedMigrationError,
} from "./migration-errors.js"
import type { SqliteMigration } from "./migrations.js"

const CREATE_SCHEMA_MIGRATIONS_SQL = [
  "CREATE TABLE IF NOT EXISTS schema_migrations (",
  "  version INTEGER PRIMARY KEY CHECK (version >= 1),",
  "  name TEXT NOT NULL CHECK (length(trim(name)) > 0),",
  "  checksum TEXT NOT NULL CHECK (length(trim(checksum)) > 0),",
  "  applied_at TEXT NOT NULL CHECK (length(trim(applied_at)) > 0)",
  ") STRICT;",
].join("\n")

type AppliedMigrationRow = {
  readonly version: number | string
  readonly name: string
  readonly checksum: string
  readonly applied_at: string
}

function migrationVersionKey(version: number | string): string {
  return String(version)
}

function validatePlan(plan: readonly SqliteMigration[]): SqliteMigration[] {
  const ordered = [...plan]

  for (let index = 0; index < ordered.length; index += 1) {
    const migration = ordered[index]
    if (!migration) {
      continue
    }
    const expectedVersion = index + 1

    if (
      !Number.isSafeInteger(migration.version) ||
      migration.version < 1 ||
      migration.version !== expectedVersion
    ) {
      throw new InvalidMigrationPlanError(
        "Migration versions must be unique and contiguous from 1"
      )
    }

    if (
      migration.name.trim().length === 0 ||
      migration.checksum.trim().length === 0 ||
      migration.sql.length === 0
    ) {
      throw new InvalidMigrationPlanError(
        "Migration name, checksum and SQL are required"
      )
    }

    const previous = ordered[index - 1]
    if (previous && previous.version === migration.version) {
      throw new InvalidMigrationPlanError(
        "Migration versions must be unique and contiguous from 1"
      )
    }
  }

  return ordered
}

export class SqliteMigrationRunner {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly migrations: readonly SqliteMigration[]
  ) {}

  public async migrate(): Promise<void> {
    const plan = validatePlan(this.migrations)

    await this.database.transaction(async (transaction) => {
      await transaction.executeBatch(CREATE_SCHEMA_MIGRATIONS_SQL)
    })

    const applied = await this.database.query<AppliedMigrationRow>(
      "SELECT version, name, checksum, applied_at " +
        "FROM schema_migrations ORDER BY version"
    )
    const planByVersion = new Map(
      plan.map((migration) => [
        migrationVersionKey(migration.version),
        migration,
      ])
    )
    const appliedByVersion = new Map(
      applied.map((migration) => [
        migrationVersionKey(migration.version),
        migration,
      ])
    )

    for (const appliedMigration of applied) {
      const planned = planByVersion.get(
        migrationVersionKey(appliedMigration.version)
      )
      if (!planned) {
        throw new UnknownAppliedMigrationError(Number(appliedMigration.version))
      }
      if (planned.checksum !== appliedMigration.checksum) {
        throw new ModifiedMigrationError(Number(appliedMigration.version))
      }
    }

    for (const migration of plan) {
      if (appliedByVersion.has(migrationVersionKey(migration.version))) {
        continue
      }

      await this.database.transaction(async (transaction) => {
        await transaction.executeBatch(migration.sql)
        await transaction.execute(
          "INSERT INTO schema_migrations " +
            "(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
          [
            migration.version,
            migration.name,
            migration.checksum,
            new Date().toISOString(),
          ]
        )
      })
    }
  }
}
