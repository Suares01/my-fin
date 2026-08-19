import { createHash } from "node:crypto"
import { error as logError } from "node:console"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

const MIGRATION_FILE_PATTERN = /^(\d{4,})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/

export function normalizeSql(sql) {
  return sql.replace(/\r\n?/g, "\n").replace(/\n*$/, "") + "\n"
}

export function checksumSql(sql) {
  return createHash("sha256").update(normalizeSql(sql), "utf8").digest("hex")
}

function parseMigrationFilename(filename) {
  const match = MIGRATION_FILE_PATTERN.exec(filename)
  if (!match) {
    throw new Error(
      'Invalid migration filename "' + filename + '"; expected NNNN_name.sql'
    )
  }

  const version = Number(match[1])
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('Invalid migration version in "' + filename + '"')
  }

  return { version, name: match[2] }
}

export async function readMigrations(migrationsDirectory) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true })
  const migrations = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue
    }

    const { version, name } = parseMigrationFilename(entry.name)
    const sql = normalizeSql(
      await readFile(join(migrationsDirectory, entry.name), "utf8")
    )
    migrations.push({
      version,
      name,
      checksum: checksumSql(sql),
      sql,
    })
  }

  migrations.sort((left, right) => left.version - right.version)

  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index].version === migrations[index - 1].version) {
      throw new Error(
        "Duplicate migration version " + migrations[index].version
      )
    }
  }

  for (let index = 0; index < migrations.length; index += 1) {
    const migration = migrations[index]
    const expectedVersion = index + 1

    if (migration.version !== expectedVersion) {
      throw new Error(
        "Migration versions must be contiguous from 1; expected " +
          expectedVersion +
          ", received " +
          migration.version
      )
    }
  }

  return migrations
}

export function renderGeneratedMigrations(migrations) {
  const records = migrations
    .map((migration) =>
      [
        "  {",
        "    version: " + migration.version + ",",
        "    name: " + JSON.stringify(migration.name) + ",",
        "    checksum: " + JSON.stringify(migration.checksum) + ",",
        "    sql: " + JSON.stringify(migration.sql) + ",",
        "  },",
      ].join("\n")
    )
    .join("\n")

  return [
    "// generated, do not edit",
    'import type { SqliteMigration } from "./migrations.js";',
    "",
    "export const sqliteMigrations: readonly SqliteMigration[] = [",
    records,
    "];",
    "",
  ].join("\n")
}

export async function generateMigrations({
  migrationsDirectory,
  outputFile,
  check = false,
}) {
  const migrations = await readMigrations(migrationsDirectory)
  const source = renderGeneratedMigrations(migrations)

  if (check) {
    let current
    try {
      current = await readFile(outputFile, "utf8")
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error("Generated migrations are missing at " + outputFile)
      }
      throw error
    }

    if (current !== source) {
      throw new Error("Generated migrations are out of date at " + outputFile)
    }

    return { changed: false, migrations }
  }

  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, source, "utf8")
  return { changed: true, migrations }
}

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes("--check")
  const migrationsDirectory = join(packageDirectory, "migrations")
  const outputFile = join(
    packageDirectory,
    "src",
    "migrations",
    "generated-migrations.ts"
  )

  try {
    await generateMigrations({ migrationsDirectory, outputFile, check })
  } catch (error) {
    logError(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
