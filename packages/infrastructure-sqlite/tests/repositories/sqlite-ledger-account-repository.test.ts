import {
  ApplicationError,
  type DomainFactCollector,
} from "@workspace/application"
import {
  Currency,
  FinancialBook,
  LedgerAccount,
  type BookId,
  type DomainFact,
  type LedgerAccountSnapshot,
  bookIdFromString,
  ledgerAccountIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function accountSnapshot(
  overrides: Partial<LedgerAccountSnapshot> = {}
): LedgerAccountSnapshot {
  const kind = overrides.kind ?? "ASSET"
  const systemPurpose = overrides.systemPurpose
  return {
    id: ledgerAccountIdFromString("account-1"),
    bookId: bookIdFromString("book-1"),
    name: "Cash",
    normalizedName: "cash",
    kind,
    status: "ACTIVE",
    version: 0,
    ...(systemPurpose === undefined && kind === "INCOME"
      ? { iconKey: "label-dollar", colorHex: "10b981" }
      : systemPurpose === undefined && kind === "EXPENSE"
        ? { iconKey: "label-dollar", colorHex: "f43f5e" }
        : {}),
    ...overrides,
  }
}

function restoredAccount(
  overrides: Partial<LedgerAccountSnapshot> = {}
): LedgerAccount {
  return LedgerAccount.restore(accountSnapshot(overrides))
}

function createdAccount(
  id: string,
  bookId: BookId = bookIdFromString("book-1")
): LedgerAccount {
  return LedgerAccount.create({
    id: ledgerAccountIdFromString(id),
    bookId,
    name: "Cash",
    kind: "ASSET",
  })
}

function book(id: string): FinancialBook {
  return FinancialBook.create({
    id: bookIdFromString(id),
    name: id,
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

describe("SqliteLedgerAccountRepository", () => {
  let database: BetterSqliteDatabase
  let books: SqliteFinancialBookRepository

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    books = new SqliteFinancialBookRepository(database)
    await books.add(book("book-1"))
  })

  afterEach(async () => {
    await database.close()
  })

  it("returns null for an absent account", async () => {
    const repository = new SqliteLedgerAccountRepository(database)

    await expect(
      repository.findById(ledgerAccountIdFromString("missing"))
    ).resolves.toBeNull()
  })

  it("adds and rehydrates every account field independently", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    const account = restoredAccount({
      systemPurpose: "OPENING_BALANCE",
      status: "ARCHIVED",
      version: 2,
    })

    await repository.add(LedgerAccount.restore(accountSnapshot()))
    const loaded = await repository.findById(account.id)

    expect(loaded).not.toBe(account)
    expect(loaded?.toSnapshot()).toEqual(accountSnapshot())
  })

  it("adds and finds managed category appearance exactly", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    const category = restoredAccount({ kind: "EXPENSE" })

    await repository.add(category)

    expect((await repository.findById(category.id))?.toSnapshot()).toEqual(
      category.toSnapshot()
    )
  })

  it("adds and finds common accounts with absent appearance", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    const account = restoredAccount({ kind: "ASSET" })

    await repository.add(account)

    const snapshot = (await repository.findById(account.id))?.toSnapshot()
    expect(snapshot).not.toHaveProperty("iconKey")
    expect(snapshot).not.toHaveProperty("colorHex")
  })

  it("saves category name and appearance in one optimistic update", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    const initial = restoredAccount({ kind: "EXPENSE" })
    const updated = restoredAccount({
      kind: "EXPENSE",
      status: "ARCHIVED",
      name: "Food",
      normalizedName: "food",
      iconKey: "briefcase",
      colorHex: "10b981",
      version: 1,
    })
    await repository.add(initial)
    const execute = vi.spyOn(database, "execute")

    await repository.save(updated, 0)

    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]?.[0]).toContain("icon_key = ?, color_hex = ?")
    expect((await repository.findById(updated.id))?.toSnapshot()).toEqual(
      updated.toSnapshot()
    )
  })

  it("preserves category identity fields while saving appearance", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    const initial = restoredAccount({ kind: "INCOME" })
    const updated = restoredAccount({
      kind: "INCOME",
      status: "ACTIVE",
      name: "Salary",
      normalizedName: "salary",
      iconKey: "briefcase",
      colorHex: "10b981",
      version: 1,
    })
    await repository.add(initial)

    await repository.save(updated, 0)

    expect((await repository.findById(updated.id))?.toSnapshot()).toMatchObject(
      {
        id: initial.id,
        bookId: initial.bookId,
        kind: "INCOME",
        status: "ACTIVE",
        iconKey: "briefcase",
        colorHex: "10b981",
        version: 1,
      }
    )
  })

  it("rejects a stale appearance save without partial state or facts", async () => {
    const facts = new RecordingFacts()
    const repository = new SqliteLedgerAccountRepository(database, facts)
    const initial = restoredAccount({ kind: "EXPENSE" })
    const persisted = restoredAccount({
      kind: "EXPENSE",
      name: "Persisted",
      normalizedName: "persisted",
      iconKey: "briefcase",
      colorHex: "10b981",
      version: 1,
    })
    const stale = restoredAccount({
      kind: "EXPENSE",
      name: "Stale",
      normalizedName: "stale",
      iconKey: "label-dollar",
      colorHex: "f43f5e",
      version: 1,
    })
    await repository.add(initial)
    facts.pull()
    await repository.save(persisted, 0)
    facts.pull()

    await expect(repository.save(stale, 0)).rejects.toMatchObject({
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    expect(facts.recorded).toEqual([])
    expect((await repository.findById(initial.id))?.toSnapshot()).toEqual(
      persisted.toSnapshot()
    )
  })

  it("keeps appearance absent when a common account is renamed", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    const initial = restoredAccount({ kind: "LIABILITY" })
    const updated = restoredAccount({
      kind: "LIABILITY",
      name: "Card",
      normalizedName: "card",
      version: 1,
    })
    await repository.add(initial)

    await repository.save(updated, 0)

    const snapshot = (await repository.findById(updated.id))?.toSnapshot()
    expect(snapshot).toMatchObject({ name: "Card", version: 1 })
    expect(snapshot).not.toHaveProperty("iconKey")
    expect(snapshot).not.toHaveProperty("colorHex")
  })

  it("finds system purposes only within the requested book", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount({ systemPurpose: "OPENING_BALANCE" }))
    await books.add(book("book-2"))
    await repository.add(
      restoredAccount({
        id: ledgerAccountIdFromString("account-2"),
        bookId: bookIdFromString("book-2"),
        systemPurpose: "OPENING_BALANCE",
      })
    )

    expect(
      (
        await repository.findBySystemPurpose(
          bookIdFromString("book-1"),
          "OPENING_BALANCE"
        )
      )?.toSnapshot().bookId
    ).toBe("book-1")
    expect(
      await repository.findBySystemPurpose(
        bookIdFromString("book-3"),
        "OPENING_BALANCE"
      )
    ).toBeNull()
  })

  it("checks normalized names by book and kind", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())
    await books.add(book("book-2"))
    await repository.add(
      restoredAccount({
        id: ledgerAccountIdFromString("account-2"),
        bookId: bookIdFromString("book-2"),
      })
    )

    await expect(
      repository.existsWithName(bookIdFromString("book-1"), "ASSET", "cash")
    ).resolves.toBe(true)
    await expect(
      repository.existsWithName(bookIdFromString("book-3"), "ASSET", "cash")
    ).resolves.toBe(false)
  })

  it("excludes the target account while retaining another same-kind collision", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())
    await repository.add(
      restoredAccount({
        id: ledgerAccountIdFromString("account-2"),
        name: "Cash copy",
        normalizedName: "cash copy",
      })
    )

    await expect(
      repository.existsWithName(
        bookIdFromString("book-1"),
        "ASSET",
        "cash",
        ledgerAccountIdFromString("account-1")
      )
    ).resolves.toBe(false)
    await expect(
      repository.existsWithName(
        bookIdFromString("book-1"),
        "ASSET",
        "cash",
        ledgerAccountIdFromString("account-2")
      )
    ).resolves.toBe(true)
  })

  it("rejects a new account that does not start at version zero", async () => {
    const repository = new SqliteLedgerAccountRepository(database)

    await expect(
      repository.add(restoredAccount({ version: 1 }))
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    await expect(
      repository.findById(ledgerAccountIdFromString("account-1"))
    ).resolves.toBeNull()
  })

  it("maps duplicate IDs to DUPLICATE_ENTITY", async () => {
    const facts = new RecordingFacts()
    const repository = new SqliteLedgerAccountRepository(database, facts)
    await repository.add(createdAccount("account-1"))
    expect(facts.recorded).toHaveLength(1)
    facts.pull()

    await expect(
      repository.add(createdAccount("account-1"))
    ).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    } satisfies Partial<ApplicationError>)
    expect(facts.recorded).toEqual([])
  })

  it("maps duplicate normalized names to DUPLICATE_ENTITY", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())

    await expect(
      repository.add(
        restoredAccount({
          id: ledgerAccountIdFromString("account-2"),
        })
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
  })

  it("maps duplicate system purposes to DUPLICATE_ENTITY", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount({ systemPurpose: "OPENING_BALANCE" }))

    await expect(
      repository.add(
        restoredAccount({
          id: ledgerAccountIdFromString("account-2"),
          name: "Opening",
          normalizedName: "opening",
          systemPurpose: "OPENING_BALANCE",
        })
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
  })

  it("saves the exact next version and preserves the updated snapshot", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())

    await repository.save(
      restoredAccount({ status: "ARCHIVED", version: 1 }),
      0
    )

    expect(
      (
        await repository.findById(ledgerAccountIdFromString("account-1"))
      )?.toSnapshot()
    ).toEqual(accountSnapshot({ status: "ARCHIVED", version: 1 }))
  })

  it("persists a case-only rename without changing identity, kind or status", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())

    await repository.save(
      restoredAccount({ name: "CASH", normalizedName: "cash", version: 1 }),
      0
    )

    expect(
      (
        await repository.findById(ledgerAccountIdFromString("account-1"))
      )?.toSnapshot()
    ).toEqual(
      accountSnapshot({ name: "CASH", normalizedName: "cash", version: 1 })
    )
  })

  it("keeps archived names in the uniqueness guard during a rename", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())
    await repository.add(
      restoredAccount({
        id: ledgerAccountIdFromString("account-2"),
        name: "Archived cash",
        normalizedName: "archived cash",
        status: "ARCHIVED",
      })
    )

    await expect(
      repository.save(
        restoredAccount({
          name: "Archived cash",
          normalizedName: "archived cash",
          version: 1,
        }),
        0
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })
    await expect(
      repository.findById(ledgerAccountIdFromString("account-1"))
    ).resolves.toMatchObject({
      name: "Cash",
      normalizedName: "cash",
      version: 0,
    })
  })

  it("persists reactivation with the exact next version and identity", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount({ status: "ARCHIVED" }))

    await repository.save(restoredAccount({ status: "ACTIVE", version: 1 }), 0)

    expect(
      (
        await repository.findById(ledgerAccountIdFromString("account-1"))
      )?.toSnapshot()
    ).toEqual(accountSnapshot({ status: "ACTIVE", version: 1 }))
  })

  it("rejects changing the persisted account kind and preserves state", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())

    await expect(
      repository.save(restoredAccount({ kind: "LIABILITY", version: 1 }), 0)
    ).rejects.toMatchObject({ code: "IMMUTABLE_ACCOUNT_KIND" })
    expect(
      (
        await repository.findById(ledgerAccountIdFromString("account-1"))
      )?.toSnapshot()
    ).toEqual(accountSnapshot())
  })

  it("distinguishes a missing account during save", async () => {
    const repository = new SqliteLedgerAccountRepository(database)

    await expect(
      repository.save(restoredAccount({ version: 1 }), 0)
    ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" })
    await expect(
      repository.findById(ledgerAccountIdFromString("account-1"))
    ).resolves.toBeNull()
  })

  it("distinguishes a version conflict and preserves state", async () => {
    const repository = new SqliteLedgerAccountRepository(database)
    await repository.add(restoredAccount())

    await expect(
      repository.save(
        restoredAccount({ name: "Stale", normalizedName: "stale", version: 1 }),
        1
      )
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    expect(
      (
        await repository.findById(ledgerAccountIdFromString("account-1"))
      )?.toSnapshot()
    ).toEqual(accountSnapshot())
  })
})
