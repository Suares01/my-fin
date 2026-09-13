import {
  Currency,
  FinancialBook,
  JournalEntry,
  LedgerAccount,
  LocalDate,
  Money,
  Posting,
  type DomainFact,
} from "@workspace/domain"
import type {
  DomainFactCollector,
  RepositoryContext,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import type {
  SqliteExecutionResult,
  SqliteExecutor,
} from "../database/index.js"
import { createSqliteRepositoryContext } from "./create-sqlite-repository-context.js"

class RecordingExecutor implements SqliteExecutor {
  public readonly queries: string[] = []
  public readonly executions: string[] = []

  public async execute(sql: string): Promise<SqliteExecutionResult> {
    this.executions.push(sql)
    return { rowsAffected: 1, lastInsertRowId: "1" }
  }

  public async query<Row extends Record<string, unknown>>(
    sql: string
  ): Promise<Row[]> {
    this.queries.push(sql)
    return []
  }

  public async executeBatch(): Promise<void> {}
}

class RecordingFacts implements DomainFactCollector {
  public readonly recorded: DomainFact[][] = []

  public record(facts: readonly DomainFact[]): void {
    this.recorded.push([...facts])
  }

  public pull(): readonly DomainFact[] {
    return this.recorded.flat()
  }
}

function context(
  executor = new RecordingExecutor(),
  facts = new RecordingFacts()
): {
  context: RepositoryContext
  executor: RecordingExecutor
  facts: RecordingFacts
} {
  return {
    context: createSqliteRepositoryContext(executor, facts),
    executor,
    facts,
  }
}

function book(): FinancialBook {
  return FinancialBook.create({
    id: "book-1" as never,
    name: "Main",
    baseCurrency: Currency.parse("BRL"),
    timezone: "America/Sao_Paulo",
  })
}

function account(): LedgerAccount {
  return LedgerAccount.create({
    id: "account-1" as never,
    bookId: "book-1" as never,
    name: "Cash",
    kind: "ASSET",
  })
}

function entry(): JournalEntry {
  return JournalEntry.post({
    id: "entry-1" as never,
    bookId: "book-1" as never,
    occurredOn: LocalDate.parse("2026-08-04"),
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: "Opening",
    currency: Currency.parse("BRL"),
    origin: "SYSTEM",
    postings: [
      Posting.create({
        id: "posting-1" as never,
        accountId: "account-1" as never,
        amount: Money.of(100n, Currency.parse("BRL")),
      }),
      Posting.create({
        id: "posting-2" as never,
        accountId: "account-2" as never,
        amount: Money.of(-100n, Currency.parse("BRL")),
      }),
    ],
  })
}

describe("createSqliteRepositoryContext", () => {
  it("returns exactly the current repository context shape", () => {
    const fixture = context()

    expect(Object.keys(fixture.context).sort()).toEqual([
      "accounts",
      "books",
      "facts",
      "journalEntries",
    ])
    expect(fixture.context.facts).toBe(fixture.facts)
  })

  it("routes book and account reads through the supplied executor", async () => {
    const fixture = context()

    await fixture.context.books.findById("book-1" as never)
    await fixture.context.accounts.findById("account-1" as never)

    expect(fixture.executor.queries).toHaveLength(2)
  })

  it("routes journal reads through the supplied executor", async () => {
    const fixture = context()

    await fixture.context.journalEntries.findById("entry-1" as never)

    expect(fixture.executor.queries).toHaveLength(1)
  })

  it("shares the supplied fact collector across all repositories", async () => {
    const fixture = context()

    await fixture.context.books.add(book())
    await fixture.context.accounts.add(account())
    await fixture.context.journalEntries.add(entry())

    expect(fixture.facts.recorded.map((facts) => facts[0]?.type)).toEqual([
      "FinancialBookCreated",
      "LedgerAccountCreated",
      "JournalEntryPosted",
    ])
  })

  it("routes every repository write through the supplied executor", async () => {
    const fixture = context()

    await fixture.context.books.add(book())
    await fixture.context.books.save(
      FinancialBook.restore({ ...book().toSnapshot(), version: 1 }),
      0
    )
    await fixture.context.accounts.add(account())
    await fixture.context.accounts.save(
      LedgerAccount.restore({ ...account().toSnapshot(), version: 1 }),
      0
    )
    await fixture.context.journalEntries.add(entry())
    await fixture.context.journalEntries.save(
      JournalEntry.restore({
        ...entry().toSnapshot(),
        version: 1,
        reversedBy: "entry-2" as never,
      }),
      0
    )

    expect(fixture.executor.executions.map((sql) => sql.split(" ")[0])).toEqual(
      [
        "INSERT",
        "UPDATE",
        "INSERT",
        "DELETE",
        "INSERT",
        "UPDATE",
        "DELETE",
        "INSERT",
        "INSERT",
        "INSERT",
        "INSERT",
        "UPDATE",
      ]
    )
  })
})
