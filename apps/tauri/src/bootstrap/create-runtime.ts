import {
  configureSqliteConnection,
  sqliteMigrations,
  SqliteMigrationRunner,
  type SqliteDatabase,
  type SqliteInitializationOptions,
  verifySqliteConnection,
} from "@workspace/infrastructure-sqlite"
import {
  TauriClock,
  TauriEventPublisher,
  TauriIdGenerator,
  TauriSqliteDatabase,
} from "@workspace/infrastructure-tauri"
import { createMyFinServices, type MyFinServices } from "./create-services.js"

export type BootstrapErrorCode =
  | "VAULT_OPEN_FAILED"
  | "SQLITE_CONFIGURATION_FAILED"
  | "SQLITE_CONFIGURATION_MISMATCH"
  | "MIGRATION_FAILED"
  | "RUNTIME_COMPOSITION_FAILED"
  | "RUNTIME_HEALTH_FAILED"

export class BootstrapError extends Error {
  public readonly code: BootstrapErrorCode
  public readonly diagnosticId: string

  public constructor(code: BootstrapErrorCode, diagnosticId: string) {
    super("My Fin could not prepare the local vault")
    this.name = "BootstrapError"
    this.code = code
    this.diagnosticId = diagnosticId
  }
}

export interface MyFinRuntime {
  readonly services: MyFinServices
  health(): Promise<void>
  dispose(): Promise<void>
}

type RuntimeDatabase = SqliteDatabase & {
  open(): Promise<void>
  health(): Promise<void>
}

type RuntimeStage = "open" | "configure" | "verify" | "migrate" | "compose"

export type CreateRuntimeOptions = {
  readonly database?: RuntimeDatabase
  readonly createDatabase?: () => RuntimeDatabase
  readonly clock?: ConstructorParameters<typeof TauriClock>[0]
  readonly ids?: ConstructorParameters<typeof TauriIdGenerator>[0]
  readonly publisher?: TauriEventPublisher
  readonly configure?: (
    database: SqliteDatabase,
    options: SqliteInitializationOptions
  ) => Promise<void>
  readonly verify?: (
    database: SqliteDatabase,
    options: SqliteInitializationOptions
  ) => Promise<void>
  readonly migrate?: (database: SqliteDatabase) => Promise<void>
  readonly compose?: (dependencies: {
    readonly database: SqliteDatabase
    readonly clock: TauriClock
    readonly ids: TauriIdGenerator
    readonly publisher: TauriEventPublisher
  }) => MyFinServices
}

const fileOptions: SqliteInitializationOptions = { inMemory: false }

export async function createMyFinRuntime(
  options: CreateRuntimeOptions = {}
): Promise<MyFinRuntime> {
  let database: RuntimeDatabase | undefined
  let stage: RuntimeStage = "open"

  try {
    database =
      options.database ??
      (options.createDatabase ?? (() => new TauriSqliteDatabase()))()
    console.info("[bootstrap] stage=open")
    await database.open()

    stage = "configure"
    console.info("[bootstrap] stage=configure")
    await (options.configure ?? configureSqliteConnection)(
      database,
      fileOptions
    )

    stage = "verify"
    console.info("[bootstrap] stage=verify")
    await (options.verify ?? verifySqliteConnection)(database, fileOptions)

    stage = "migrate"
    console.info("[bootstrap] stage=migrate")
    await (
      options.migrate ??
      ((connection) =>
        new SqliteMigrationRunner(connection, sqliteMigrations).migrate())
    )(database)

    stage = "compose"
    console.info("[bootstrap] stage=compose")
    const clock = new TauriClock(options.clock)
    const ids = new TauriIdGenerator(options.ids)
    const publisher = options.publisher ?? new TauriEventPublisher()
    const services = (
      options.compose ?? ((dependencies) => createMyFinServices(dependencies))
    )({ database, clock, ids, publisher })
    const initializedDatabase = database

    let disposed = false
    return {
      services,
      health: () => initializedDatabase.health(),
      dispose: async () => {
        if (disposed) {
          return
        }
        disposed = true
        await initializedDatabase.close()
      },
    }
  } catch (error: unknown) {
    await database?.close().catch(() => undefined)
    const bootstrapError = toBootstrapError(stage, error)
    console.error("[bootstrap] failed", {
      stage,
      code: bootstrapError.code,
      diagnosticId: bootstrapError.diagnosticId,
      cause: error instanceof Error ? error.message : undefined,
    })
    throw bootstrapError
  }
}

function toBootstrapError(stage: RuntimeStage, error: unknown): BootstrapError {
  const code: BootstrapErrorCode =
    stage === "open"
      ? "VAULT_OPEN_FAILED"
      : stage === "configure"
        ? "SQLITE_CONFIGURATION_FAILED"
        : stage === "verify"
          ? isPragmaMismatch(error)
            ? "SQLITE_CONFIGURATION_MISMATCH"
            : "SQLITE_CONFIGURATION_FAILED"
          : stage === "migrate"
            ? "MIGRATION_FAILED"
            : "RUNTIME_COMPOSITION_FAILED"

  return new BootstrapError(code, diagnosticIdFor(stage, error))
}

function isPragmaMismatch(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_PRAGMA_MISMATCH"
  )
}

function diagnosticIdFor(stage: RuntimeStage, error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "diagnosticId" in error &&
    typeof error.diagnosticId === "string" &&
    /^[a-z0-9-]+$/i.test(error.diagnosticId)
  ) {
    return error.diagnosticId
  }

  return `bootstrap-${stage}`
}
