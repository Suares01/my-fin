import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  checksumSql,
  generateMigrations,
  normalizeSql,
  readMigrations,
  renderGeneratedMigrations,
} from "./generate-migrations.mjs"

const temporaryDirectories = []

async function createFixture(files) {
  const directory = await mkdtemp(join(tmpdir(), "my-fin-migrations-"))
  temporaryDirectories.push(directory)

  for (const [filename, sql] of Object.entries(files)) {
    await writeFile(join(directory, filename), sql, "utf8")
  }

  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true }))
  )
})

describe("generate-migrations", () => {
  it("orders migrations and renders a stable generated module", async () => {
    const directory = await createFixture({
      "0002_add_accounts.sql": "CREATE TABLE accounts (id TEXT);",
      "0001_create_books.sql": "CREATE TABLE books (id TEXT);",
    })

    const migrations = await readMigrations(directory)
    const source = renderGeneratedMigrations(migrations)

    expect(migrations.map(({ version }) => version)).toEqual([1, 2])
    expect(source.startsWith("// generated, do not edit")).toBe(true)
    expect(source).toBe(renderGeneratedMigrations(migrations))
  })

  it("rejects migration filenames with an invalid name", async () => {
    const directory = await createFixture({
      "0001-incorrect.sql": "SELECT 1;",
    })

    await expect(readMigrations(directory)).rejects.toThrow(
      "Invalid migration filename"
    )
  })

  it("rejects gaps in migration versions", async () => {
    const directory = await createFixture({
      "0002_second.sql": "SELECT 1;",
    })

    await expect(readMigrations(directory)).rejects.toThrow("contiguous from 1")
  })

  it("rejects duplicate migration versions", async () => {
    const directory = await createFixture({
      "0001_first.sql": "SELECT 1;",
      "0001_other.sql": "SELECT 2;",
    })

    await expect(readMigrations(directory)).rejects.toThrow(
      "Duplicate migration version"
    )
  })

  it("normalizes line endings and hashes the canonical SQL", () => {
    const sql = "SELECT 1;" + String.fromCharCode(13, 10, 13, 10)
    const canonical = "SELECT 1;" + String.fromCharCode(10)
    const expected = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex")

    expect(normalizeSql(sql)).toBe(canonical)
    expect(checksumSql(sql)).toBe(expected)
  })

  it("check mode validates without rewriting an up-to-date module", async () => {
    const directory = await createFixture({
      "0001_first.sql": "SELECT 1;",
    })
    const outputFile = join(directory, "generated.ts")
    await generateMigrations({ migrationsDirectory: directory, outputFile })
    const before = await readFile(outputFile, "utf8")

    await generateMigrations({
      migrationsDirectory: directory,
      outputFile,
      check: true,
    })

    expect(await readFile(outputFile, "utf8")).toBe(before)
  })

  it("check mode fails without writing when the module has drifted", async () => {
    const directory = await createFixture({
      "0001_first.sql": "SELECT 1;",
    })
    const outputFile = join(directory, "generated.ts")
    await writeFile(outputFile, "stale", "utf8")

    await expect(
      generateMigrations({
        migrationsDirectory: directory,
        outputFile,
        check: true,
      })
    ).rejects.toThrow("out of date")
    expect(await readFile(outputFile, "utf8")).toBe("stale")
  })
})
