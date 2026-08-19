import {
  ApplicationError,
  type DomainFactCollector,
} from "@workspace/application"
import {
  Currency,
  FinancialBook,
  type DomainFact,
  type FinancialBookSnapshot,
  bookIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function snapshot(
  overrides: Partial<FinancialBookSnapshot> = {}
): FinancialBookSnapshot {
  return {
    id: bookIdFromString("book-1"),
    name: "Main",
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
    version: 0,
    ...overrides,
  }
}

function restored(
  overrides: Partial<FinancialBookSnapshot> = {}
): FinancialBook {
  return FinancialBook.restore(snapshot(overrides))
}

function created(id: string): FinancialBook {
  return FinancialBook.create({
    id: bookIdFromString(id),
    name: "Main",
    baseCurrency: Currency.parse("BRL"),
    timezone: "America/Sao_Paulo",
  })
}

class RecordingFacts implements DomainFactCollector {
  public readonly recorded: DomainFact[] = []

  public record(facts: readonly DomainFact[]): void {
    this.recorded.push(...facts)
  }

  public pull(): readonly DomainFact[] {
    return this.recorded.splice(0)
  }
}

describe("SqliteFinancialBookRepository", () => {
  let database: BetterSqliteDatabase

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
  })

  afterEach(async () => {
    await database.close()
  })

  it("returns null for an absent book", async () => {
    const repository = new SqliteFinancialBookRepository(database)

    await expect(
      repository.findById(bookIdFromString("missing"))
    ).resolves.toBeNull()
  })

  it("adds and rehydrates an independent aggregate with an exact snapshot", async () => {
    const repository = new SqliteFinancialBookRepository(database)
    const book = restored()

    await repository.add(book)
    const loaded = await repository.findById(book.id)

    expect(loaded).not.toBe(book)
    expect(loaded?.toSnapshot()).toEqual(book.toSnapshot())
  })

  it("rejects a new book that does not start at version zero", async () => {
    const repository = new SqliteFinancialBookRepository(database)

    await expect(
      repository.add(restored({ version: 1 }))
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    await expect(
      repository.findById(bookIdFromString("book-1"))
    ).resolves.toBeNull()
  })

  it("maps a duplicate ID to DUPLICATE_ENTITY", async () => {
    const repository = new SqliteFinancialBookRepository(database)
    await repository.add(restored())

    await expect(repository.add(restored())).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    } satisfies Partial<ApplicationError>)
  })

  it("saves only the exact next version and records facts after success", async () => {
    const facts = new RecordingFacts()
    const repository = new SqliteFinancialBookRepository(database, facts)
    const book = created("book-1")
    await repository.add(book)
    expect(facts.recorded).toHaveLength(1)
    facts.pull()

    const updated = restored({ name: "Updated", version: 1 })
    const executeSpy = vi.spyOn(database, "execute")
    await repository.save(updated, 0)

    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(executeSpy.mock.calls[0]?.[0]).toContain(
      "WHERE id = ? AND version = ?"
    )
    expect((await repository.findById(updated.id))?.toSnapshot()).toEqual(
      snapshot({ name: "Updated", version: 1 })
    )
    expect(facts.recorded).toHaveLength(0)
  })

  it("rejects saving a missing book without creating a row", async () => {
    const repository = new SqliteFinancialBookRepository(database)

    await expect(
      repository.save(restored({ version: 1 }), 0)
    ).rejects.toMatchObject({
      code: "ENTITY_NOT_FOUND",
    })
    await expect(
      repository.findById(bookIdFromString("book-1"))
    ).resolves.toBeNull()
  })

  it("distinguishes a stale version and preserves the persisted row", async () => {
    const repository = new SqliteFinancialBookRepository(database)
    await repository.add(restored())

    await expect(
      repository.save(restored({ name: "Stale", version: 1 }), 1)
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    expect(
      (await repository.findById(bookIdFromString("book-1")))?.toSnapshot()
    ).toEqual(snapshot())
  })

  it("does not collect facts when a duplicate write fails", async () => {
    const facts = new RecordingFacts()
    const repository = new SqliteFinancialBookRepository(database, facts)
    await repository.add(created("book-1"))
    facts.pull()

    await expect(repository.add(created("book-1"))).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    })
    expect(facts.recorded).toEqual([])
  })
})
