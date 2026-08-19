import {
  ApplicationError,
  type DomainFactCollector,
} from "@workspace/application"
import {
  Currency,
  FinancialBook,
  JournalEntry,
  LocalDate,
  LedgerAccount,
  Money,
  Posting,
  type BookId,
  type DomainFact,
  type JournalEntrySnapshot,
  bookIdFromString,
  journalEntryIdFromString,
  ledgerAccountIdFromString,
  postingIdFromString,
} from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeSqliteDatabase } from "../../src/database/initialize-sqlite-database.js"
import { SqliteFinancialBookRepository } from "../../src/repositories/sqlite-financial-book-repository.js"
import { SqliteJournalEntryRepository } from "../../src/repositories/sqlite-journal-entry-repository.js"
import { SqliteLedgerAccountRepository } from "../../src/repositories/sqlite-ledger-account-repository.js"
import { BetterSqliteDatabase } from "../support/better-sqlite-database.js"

function book(id: string): FinancialBook {
  return FinancialBook.restore({
    id: bookIdFromString(id),
    name: id,
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
    version: 0,
  })
}

function account(
  id: string,
  bookId: BookId = bookIdFromString("book-1"),
  systemPurpose?: "OPENING_BALANCE"
): LedgerAccount {
  return LedgerAccount.restore({
    id: ledgerAccountIdFromString(id),
    bookId,
    name: systemPurpose === undefined ? id : "Opening balance",
    normalizedName: systemPurpose === undefined ? id : "opening-balance",
    kind: systemPurpose === undefined ? "ASSET" : "EQUITY",
    status: "ACTIVE",
    ...(systemPurpose === undefined ? {} : { systemPurpose }),
    version: 0,
  })
}

function entrySnapshot(
  overrides: Partial<JournalEntrySnapshot> = {}
): JournalEntrySnapshot {
  return {
    id: journalEntryIdFromString("entry-1"),
    bookId: bookIdFromString("book-1"),
    occurredOn: "2026-08-04",
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: "Opening",
    currency: "BRL",
    origin: "SYSTEM",
    postings: [
      {
        id: postingIdFromString("posting-1"),
        accountId: ledgerAccountIdFromString("account-1"),
        amountMinor: 100n,
        currency: "BRL",
      },
      {
        id: postingIdFromString("posting-2"),
        accountId: ledgerAccountIdFromString("account-2"),
        amountMinor: -100n,
        currency: "BRL",
      },
    ],
    version: 0,
    ...overrides,
  }
}

function restoredEntry(
  overrides: Partial<JournalEntrySnapshot> = {}
): JournalEntry {
  return JournalEntry.restore(entrySnapshot(overrides))
}

function createdEntry(id: string): JournalEntry {
  return JournalEntry.post({
    id: journalEntryIdFromString(id),
    bookId: bookIdFromString("book-1"),
    occurredOn: LocalDate.parse("2026-08-04"),
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "10",
    description: "Created entry",
    currency: Currency.parse("BRL"),
    origin: "MANUAL",
    postings: [
      Posting.create({
        id: postingIdFromString(`${id}-posting-1`),
        accountId: ledgerAccountIdFromString("account-1"),
        amount: Money.of(100n, Currency.parse("BRL")),
      }),
      Posting.create({
        id: postingIdFromString(`${id}-posting-2`),
        accountId: ledgerAccountIdFromString("account-2"),
        amount: Money.of(-100n, Currency.parse("BRL")),
      }),
    ],
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

describe("SqliteJournalEntryRepository", () => {
  let database: BetterSqliteDatabase
  let books: SqliteFinancialBookRepository
  let accounts: SqliteLedgerAccountRepository
  let repository: SqliteJournalEntryRepository

  beforeEach(async () => {
    database = new BetterSqliteDatabase()
    await initializeSqliteDatabase(database, { inMemory: true })
    books = new SqliteFinancialBookRepository(database)
    accounts = new SqliteLedgerAccountRepository(database)
    await books.add(book("book-1"))
    await accounts.add(account("account-1"))
    await accounts.add(account("account-2"))
    repository = new SqliteJournalEntryRepository(database)
  })

  afterEach(async () => {
    await database.close()
  })

  it("returns null for an absent entry", async () => {
    await expect(
      repository.findById(journalEntryIdFromString("missing"))
    ).resolves.toBeNull()
  })

  it("hydrates postings in position order with exact large amounts", async () => {
    const entry = restoredEntry({
      postings: [
        {
          id: postingIdFromString("posting-1"),
          accountId: ledgerAccountIdFromString("account-1"),
          amountMinor: 9007199254740993n,
          currency: "BRL",
        },
        {
          id: postingIdFromString("posting-2"),
          accountId: ledgerAccountIdFromString("account-2"),
          amountMinor: -9007199254740993n,
          currency: "BRL",
        },
      ],
    })
    await repository.add(entry)

    const loaded = await repository.findById(entry.id)

    expect(loaded?.toSnapshot()).toEqual(entry.toSnapshot())
    expect(loaded?.postings.map((posting) => posting.id)).toEqual([
      "posting-1",
      "posting-2",
    ])
  })

  it("hydrates an entry with one ordered query", async () => {
    await repository.add(restoredEntry())
    const querySpy = vi.spyOn(database, "query")

    await repository.findById(journalEntryIdFromString("entry-1"))

    expect(querySpy).toHaveBeenCalledTimes(1)
  })

  it("finds only an active opening balance in the requested book", async () => {
    await accounts.add(
      account("opening-1", bookIdFromString("book-1"), "OPENING_BALANCE")
    )
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("opening-entry"),
        postings: [
          {
            id: postingIdFromString("opening-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: 100n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("opening-posting-2"),
            accountId: ledgerAccountIdFromString("opening-1"),
            amountMinor: -100n,
            currency: "BRL",
          },
        ],
      })
    )
    await books.add(book("book-2"))

    expect(
      (
        await repository.findActiveOpeningBalanceByAccount(
          bookIdFromString("book-1"),
          ledgerAccountIdFromString("account-1")
        )
      )?.id
    ).toBe("opening-entry")
    await expect(
      repository.findActiveOpeningBalanceByAccount(
        bookIdFromString("book-2"),
        ledgerAccountIdFromString("account-1")
      )
    ).resolves.toBeNull()
  })

  it("excludes both a reversed original and its reversal from opening balance", async () => {
    await accounts.add(
      account("opening-1", bookIdFromString("book-1"), "OPENING_BALANCE")
    )
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("original-entry"),
        sequence: "1",
        postings: [
          {
            id: postingIdFromString("original-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: 100n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("original-posting-2"),
            accountId: ledgerAccountIdFromString("opening-1"),
            amountMinor: -100n,
            currency: "BRL",
          },
        ],
      })
    )
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("reversal-entry"),
        sequence: "2",
        reversalOf: journalEntryIdFromString("original-entry"),
        postings: [
          {
            id: postingIdFromString("reversal-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: -100n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("reversal-posting-2"),
            accountId: ledgerAccountIdFromString("opening-1"),
            amountMinor: 100n,
            currency: "BRL",
          },
        ],
      })
    )
    await repository.save(
      restoredEntry({
        id: journalEntryIdFromString("original-entry"),
        reversedBy: journalEntryIdFromString("reversal-entry"),
        version: 1,
        postings: [
          {
            id: postingIdFromString("original-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: 100n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("original-posting-2"),
            accountId: ledgerAccountIdFromString("opening-1"),
            amountMinor: -100n,
            currency: "BRL",
          },
        ],
      }),
      0
    )

    await expect(
      repository.findActiveOpeningBalanceByAccount(
        bookIdFromString("book-1"),
        ledgerAccountIdFromString("account-1")
      )
    ).resolves.toBeNull()
  })

  it("finds the effective replacement opening balance", async () => {
    await accounts.add(
      account("opening-1", bookIdFromString("book-1"), "OPENING_BALANCE")
    )
    const opening = restoredEntry({
      id: journalEntryIdFromString("opening-entry"),
      postings: [
        {
          id: postingIdFromString("opening-posting-1"),
          accountId: ledgerAccountIdFromString("account-1"),
          amountMinor: 100n,
          currency: "BRL",
        },
        {
          id: postingIdFromString("opening-posting-2"),
          accountId: ledgerAccountIdFromString("opening-1"),
          amountMinor: -100n,
          currency: "BRL",
        },
      ],
    })
    await repository.add(opening)
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("replacement-entry"),
        sequence: "2",
        replacementOf: opening.id,
        postings: [
          {
            id: postingIdFromString("replacement-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: 200n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("replacement-posting-2"),
            accountId: ledgerAccountIdFromString("opening-1"),
            amountMinor: -200n,
            currency: "BRL",
          },
        ],
      })
    )
    await repository.save(
      restoredEntry({
        id: opening.id,
        replacedBy: journalEntryIdFromString("replacement-entry"),
        version: 1,
        postings: opening.postings.map((posting) => ({
          id: posting.id,
          accountId: posting.accountId,
          amountMinor: posting.amount.amountMinor,
          currency: posting.amount.currency.code,
        })),
      }),
      0
    )

    await expect(
      repository.findActiveOpeningBalanceByAccount(
        bookIdFromString("book-1"),
        ledgerAccountIdFromString("account-1")
      )
    ).resolves.toMatchObject({
      id: "replacement-entry",
      replacementOf: "opening-entry",
    })
  })

  it("reserves the first sequence as one", async () => {
    await expect(
      repository.reserveNextSequence(bookIdFromString("book-1"))
    ).resolves.toBe("1")
  })

  it("reserves monotonic sequences independently by book", async () => {
    await books.add(book("book-2"))

    await expect(
      repository.reserveNextSequence(bookIdFromString("book-1"))
    ).resolves.toBe("1")
    await expect(
      repository.reserveNextSequence(bookIdFromString("book-1"))
    ).resolves.toBe("2")
    await expect(
      repository.reserveNextSequence(bookIdFromString("book-2"))
    ).resolves.toBe("1")
  })

  it("reserves distinct ordered sequences for concurrent same-book calls", async () => {
    const sequences = await Promise.all([
      repository.reserveNextSequence(bookIdFromString("book-1")),
      repository.reserveNextSequence(bookIdFromString("book-1")),
      repository.reserveNextSequence(bookIdFromString("book-1")),
    ])

    expect(sequences.sort()).toEqual(["1", "2", "3"])
  })

  it("rejects sequence overflow and preserves the previous sequence", async () => {
    await database.execute(
      "INSERT INTO journal_sequences (book_id, last_sequence) VALUES (?, ?)",
      ["book-1", "9223372036854775807"]
    )

    await expect(
      repository.reserveNextSequence(bookIdFromString("book-1"))
    ).rejects.toMatchObject({ code: "UNEXPECTED_ERROR" })
    const rows = await database.query<{ readonly sequence: string }>(
      "SELECT CAST(last_sequence AS TEXT) AS sequence FROM journal_sequences WHERE book_id = ?",
      ["book-1"]
    )
    expect(rows[0]?.sequence).toBe("9223372036854775807")
  })

  it("rejects a new entry that does not start at version zero", async () => {
    await expect(
      repository.add(restoredEntry({ version: 1 }))
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    await expect(
      repository.findById(journalEntryIdFromString("entry-1"))
    ).resolves.toBeNull()
  })

  it("maps a duplicate entry ID to DUPLICATE_ENTITY", async () => {
    await repository.add(restoredEntry())

    await expect(repository.add(restoredEntry())).rejects.toMatchObject({
      code: "DUPLICATE_ENTITY",
    } satisfies Partial<ApplicationError>)
  })

  it("maps a global posting ID collision to DUPLICATE_ENTITY and rolls back", async () => {
    await repository.add(restoredEntry())

    await expect(
      repository.add(
        restoredEntry({
          id: journalEntryIdFromString("entry-2"),
          postings: [
            {
              id: postingIdFromString("posting-1"),
              accountId: ledgerAccountIdFromString("account-1"),
              amountMinor: 50n,
              currency: "BRL",
            },
            {
              id: postingIdFromString("posting-3"),
              accountId: ledgerAccountIdFromString("account-2"),
              amountMinor: -50n,
              currency: "BRL",
            },
          ],
        })
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_ENTITY" })

    await expect(
      database.query<{ readonly count: number }>(
        "SELECT COUNT(*) AS count FROM journal_entries"
      )
    ).resolves.toEqual([{ count: 1 }])
    await expect(
      database.query<{ readonly count: number }>(
        "SELECT COUNT(*) AS count FROM postings"
      )
    ).resolves.toEqual([{ count: 2 }])
  })

  it("persists every posting in its declared order and collects facts after success", async () => {
    const facts = new RecordingFacts()
    repository = new SqliteJournalEntryRepository(database, facts)
    const entry = createdEntry("created-entry")

    await repository.add(entry)

    expect(facts.recorded).toHaveLength(1)
    expect(
      (await repository.findById(entry.id))?.postings.map(
        (posting) => posting.id
      )
    ).toEqual(["created-entry-posting-1", "created-entry-posting-2"])
  })

  it("persists replacement lineage and normalized search metadata", async () => {
    const predecessor = restoredEntry({
      description: "Café original",
      sequence: "1",
    })
    const replacement = restoredEntry({
      id: journalEntryIdFromString("replacement-entry"),
      description: "  Café corrigido  ",
      sequence: "2",
      replacementOf: predecessor.id,
      postings: [
        {
          id: postingIdFromString("replacement-posting-1"),
          accountId: ledgerAccountIdFromString("account-1"),
          amountMinor: 125n,
          currency: "BRL",
        },
        {
          id: postingIdFromString("replacement-posting-2"),
          accountId: ledgerAccountIdFromString("account-2"),
          amountMinor: -125n,
          currency: "BRL",
        },
      ],
    })

    await repository.add(predecessor)
    await repository.add(replacement)
    await repository.save(
      restoredEntry({
        replacedBy: replacement.id,
        version: 1,
      }),
      0
    )

    await expect(repository.findById(predecessor.id)).resolves.toMatchObject({
      id: predecessor.id,
      replacedBy: replacement.id,
      version: 1,
    })
    await expect(repository.findById(replacement.id)).resolves.toMatchObject({
      id: replacement.id,
      replacementOf: predecessor.id,
      description: "  Café corrigido  ",
      version: 0,
    })
    await expect(
      database.query<{
        readonly search_text: string
        readonly search_version: string
      }>(
        "SELECT search_text, CAST(search_version AS TEXT) AS search_version FROM journal_entries WHERE id = ?",
        [replacement.id]
      )
    ).resolves.toEqual([{ search_text: "café corrigido", search_version: "1" }])
  })

  it("updates reversal and replacement links in one guarded statement", async () => {
    await repository.add(restoredEntry())
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("reversal-entry"),
        sequence: "2",
        reversalOf: journalEntryIdFromString("entry-1"),
        postings: [
          {
            id: postingIdFromString("reversal-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: -100n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("reversal-posting-2"),
            accountId: ledgerAccountIdFromString("account-2"),
            amountMinor: 100n,
            currency: "BRL",
          },
        ],
      })
    )
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("replacement-entry"),
        sequence: "3",
        replacementOf: journalEntryIdFromString("entry-1"),
        postings: [
          {
            id: postingIdFromString("replacement-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: 125n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("replacement-posting-2"),
            accountId: ledgerAccountIdFromString("account-2"),
            amountMinor: -125n,
            currency: "BRL",
          },
        ],
      })
    )
    const executeSpy = vi.spyOn(database, "execute")

    await repository.save(
      restoredEntry({
        reversedBy: journalEntryIdFromString("reversal-entry"),
        replacedBy: journalEntryIdFromString("replacement-entry"),
        version: 1,
      }),
      0
    )

    const updates = executeSpy.mock.calls.filter(([sql]) =>
      sql.startsWith("UPDATE journal_entries SET reversed_by_id")
    )
    expect(updates).toHaveLength(1)
    expect(updates[0]?.[0]).toContain("replaced_by_id = ?")
    expect(
      (
        await repository.findById(journalEntryIdFromString("entry-1"))
      )?.toSnapshot()
    ).toMatchObject({
      reversedBy: "reversal-entry",
      replacedBy: "replacement-entry",
      version: 1,
    })
  })

  it("maps a cross-book account relation to UNEXPECTED_ERROR", async () => {
    await books.add(book("book-2"))
    await accounts.add(
      account("other-book-account", bookIdFromString("book-2"))
    )

    await expect(
      repository.add(
        restoredEntry({
          postings: [
            {
              id: postingIdFromString("posting-1"),
              accountId: ledgerAccountIdFromString("other-book-account"),
              amountMinor: 100n,
              currency: "BRL",
            },
            {
              id: postingIdFromString("posting-2"),
              accountId: ledgerAccountIdFromString("account-2"),
              amountMinor: -100n,
              currency: "BRL",
            },
          ],
        })
      )
    ).rejects.toMatchObject({ code: "UNEXPECTED_ERROR" })
  })

  it("rejects a posting amount outside signed 64-bit before writing", async () => {
    const executeSpy = vi.spyOn(database, "execute")

    await expect(
      repository.add(
        restoredEntry({
          postings: [
            {
              id: postingIdFromString("posting-1"),
              accountId: ledgerAccountIdFromString("account-1"),
              amountMinor: 9223372036854775808n,
              currency: "BRL",
            },
            {
              id: postingIdFromString("posting-2"),
              accountId: ledgerAccountIdFromString("account-2"),
              amountMinor: -9223372036854775808n,
              currency: "BRL",
            },
          ],
        })
      )
    ).rejects.toMatchObject({ code: "UNEXPECTED_ERROR" })
    expect(executeSpy).not.toHaveBeenCalled()
    await expect(
      repository.findById(journalEntryIdFromString("entry-1"))
    ).resolves.toBeNull()
  })

  it("saves a reversal link with the exact next version", async () => {
    await repository.add(restoredEntry())
    await repository.add(
      restoredEntry({
        id: journalEntryIdFromString("reversal-entry"),
        sequence: "2",
        reversalOf: journalEntryIdFromString("entry-1"),
        postings: [
          {
            id: postingIdFromString("reversal-posting-1"),
            accountId: ledgerAccountIdFromString("account-1"),
            amountMinor: -100n,
            currency: "BRL",
          },
          {
            id: postingIdFromString("reversal-posting-2"),
            accountId: ledgerAccountIdFromString("account-2"),
            amountMinor: 100n,
            currency: "BRL",
          },
        ],
      })
    )

    await repository.save(
      restoredEntry({
        reversedBy: journalEntryIdFromString("reversal-entry"),
        version: 1,
      }),
      0
    )

    expect(
      (
        await repository.findById(journalEntryIdFromString("entry-1"))
      )?.toSnapshot()
    ).toMatchObject({
      reversedBy: "reversal-entry",
      version: 1,
    })
  })

  it("distinguishes a missing entry during save", async () => {
    await expect(
      repository.save(restoredEntry({ version: 1 }), 0)
    ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND" })
  })

  it("distinguishes a version conflict and preserves the entry", async () => {
    await repository.add(restoredEntry())

    await expect(
      repository.save(restoredEntry({ description: "Stale", version: 1 }), 1)
    ).rejects.toMatchObject({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    expect(
      (await repository.findById(journalEntryIdFromString("entry-1")))
        ?.description
    ).toBe("Opening")
  })
})
