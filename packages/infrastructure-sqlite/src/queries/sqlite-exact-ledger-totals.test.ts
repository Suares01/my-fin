import { describe, expect, it } from "vitest"
import { createFinancialQueryScenario } from "../../tests/support/financial-query-scenario.js"
import { SqliteExactLedgerTotals } from "./sqlite-exact-ledger-totals.js"
import type { SqliteReader } from "../database/sqlite-executor.js"
import type { SqliteParameters } from "../database/sqlite-value.js"

type Query = { readonly sql: string; readonly parameters?: SqliteParameters }

function positional(query: Query): readonly unknown[] {
  if (!Array.isArray(query.parameters)) {
    throw new Error("Expected positional query parameters")
  }
  return query.parameters
}

function readerFor(
  rows: readonly {
    readonly posting_id: string
    readonly amount_minor: string
  }[]
) {
  const queries: Query[] = []
  const reader: SqliteReader = {
    async query(sql, parameters) {
      queries.push({ sql, parameters })
      const after = String((parameters as readonly string[])[1])
      return rows.filter((row) => row.posting_id > after).slice(0, 512) as never
    },
  }
  return { reader, queries }
}

describe("SqliteExactLedgerTotals", () => {
  it("sums persisted SQLite postings through the received reader", async () => {
    const scenario = await createFinancialQueryScenario()
    try {
      await scenario.createBook()
      const account = await scenario.createFinancialAccount()
      await scenario.setOpeningBalance({
        accountId: account.id,
        amountMinor: "100",
      })
      const total = await scenario.database.readTransaction((reader) =>
        new SqliteExactLedgerTotals(reader).sum({
          bookId: "book-1",
          accountIds: [account.id],
        })
      )

      expect(total).toBe("100")
    } finally {
      await scenario.close()
    }
  })

  it("returns zero for an empty posting stream", async () => {
    const { reader } = readerFor([])
    await expect(
      new SqliteExactLedgerTotals(reader).sum({ bookId: "book" })
    ).resolves.toBe("0")
  })

  it("preserves positive and negative bigint amounts exactly", async () => {
    const { reader } = readerFor([
      { posting_id: "a", amount_minor: "9223372036854775807" },
      { posting_id: "b", amount_minor: "-7" },
    ])
    await expect(
      new SqliteExactLedgerTotals(reader).sum({ bookId: "book" })
    ).resolves.toBe("9223372036854775800")
  })

  it("sums beyond SQLite signed int64 without SUM", async () => {
    const { reader } = readerFor([
      { posting_id: "a", amount_minor: "9223372036854775807" },
      { posting_id: "b", amount_minor: "9223372036854775807" },
    ])
    await expect(
      new SqliteExactLedgerTotals(reader).sum({ bookId: "book" })
    ).resolves.toBe("18446744073709551614")
  })

  it("uses a stable posting id cursor across internal pages", async () => {
    const rows = Array.from({ length: 513 }, (_, index) => ({
      posting_id: String(index).padStart(4, "0"),
      amount_minor: "1",
    }))
    const { reader, queries } = readerFor(rows)
    await expect(
      new SqliteExactLedgerTotals(reader).sum({ bookId: "book" })
    ).resolves.toBe("513")
    expect(queries).toHaveLength(2)
    expect(positional(queries[1] as Query)[1]).toBe("0511")
  })

  it("binds the book id as a parameter", async () => {
    const { reader, queries } = readerFor([])
    await new SqliteExactLedgerTotals(reader).sum({ bookId: "book-'quoted" })
    expect(positional(queries[0] as Query)[0]).toBe("book-'quoted")
  })

  it("binds an inclusive as-of date", async () => {
    const { reader, queries } = readerFor([])
    await new SqliteExactLedgerTotals(reader).sum({
      bookId: "book",
      asOf: "2026-08-04",
    })
    expect(queries[0]?.sql).toContain("e.occurred_on <= ?")
    expect(positional(queries[0] as Query)).toContain("2026-08-04")
  })

  it("binds account id filters", async () => {
    const { reader, queries } = readerFor([])
    await new SqliteExactLedgerTotals(reader).sum({
      bookId: "book",
      accountIds: ["a", "b"],
    })
    expect(queries[0]?.sql).toContain("p.account_id IN (?, ?)")
    expect(positional(queries[0] as Query)).toEqual(
      expect.arrayContaining(["a", "b"])
    )
  })

  it("binds account kind filters", async () => {
    const { reader, queries } = readerFor([])
    await new SqliteExactLedgerTotals(reader).sum({
      bookId: "book",
      accountKinds: ["ASSET", "LIABILITY"],
    })
    expect(queries[0]?.sql).toContain("a.kind IN (?, ?)")
    expect(positional(queries[0] as Query)).toEqual(
      expect.arrayContaining(["ASSET", "LIABILITY"])
    )
  })

  it("does not query when account ids are explicitly empty", async () => {
    const { reader, queries } = readerFor([])
    await expect(
      new SqliteExactLedgerTotals(reader).sum({
        bookId: "book",
        accountIds: [],
      })
    ).resolves.toBe("0")
    expect(queries).toHaveLength(0)
  })

  it("does not query when account kinds are explicitly empty", async () => {
    const { reader, queries } = readerFor([])
    await expect(
      new SqliteExactLedgerTotals(reader).sum({
        bookId: "book",
        accountKinds: [],
      })
    ).resolves.toBe("0")
    expect(queries).toHaveLength(0)
  })

  it("joins entries so date filtering cannot include orphaned postings", async () => {
    const { reader, queries } = readerFor([])
    await new SqliteExactLedgerTotals(reader).sum({ bookId: "book" })
    expect(queries[0]?.sql).toContain("JOIN journal_entries e")
  })

  it("does not use SQLite SUM or TOTAL", async () => {
    const { reader, queries } = readerFor([])
    await new SqliteExactLedgerTotals(reader).sum({ bookId: "book" })
    expect(queries[0]?.sql).not.toMatch(/\b(SUM|TOTAL)\s*\(/i)
  })
})
