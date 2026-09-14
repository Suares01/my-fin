import { describe, expect, it } from "vitest"
import type { SqliteReader } from "../database/sqlite-executor.js"
import { SqliteInvestmentTransactionReads } from "./sqlite-investment-transaction-reads.js"

type Query = { readonly sql: string; readonly parameters?: readonly unknown[] }

function readerFor(input: {
  readonly postings?: readonly {
    readonly posting_id: string
    readonly amount_minor: string
  }[]
  readonly costs?: readonly {
    readonly investment_account_id: string
    readonly book_cost_minor: string
  }[]
  readonly currency?: string
  readonly dependent?: boolean
}) {
  const queries: Query[] = []
  const reader: SqliteReader = {
    async query(sql, parameters) {
      queries.push({
        sql,
        parameters: parameters as readonly unknown[] | undefined,
      })
      if (sql.includes("FROM investment_accounts")) {
        return (input.dependent ? [{ present: 1 }] : []) as never
      }
      if (sql.includes("FROM financial_books")) {
        return [{ base_currency: input.currency ?? "BRL" }] as never
      }
      if (sql.includes("FROM investment_positions")) {
        return (input.costs ?? []) as never
      }
      if (sql.includes("FROM postings")) {
        const after = String((parameters as readonly string[])[1])
        return (input.postings ?? [])
          .filter((row) => row.posting_id > after)
          .slice(0, 512) as never
      }
      return [] as never
    },
  }
  return { reader, queries }
}

describe("SqliteInvestmentTransactionReads", () => {
  it("finds active settlement dependents", async () => {
    const { reader } = readerFor({ dependent: true })
    await expect(
      new SqliteInvestmentTransactionReads(
        reader
      ).hasActiveSettlementDependents("book", "account" as never)
    ).resolves.toBe(true)
  })

  it("does not report an absent settlement dependent", async () => {
    const { reader } = readerFor({ dependent: false })
    await expect(
      new SqliteInvestmentTransactionReads(
        reader
      ).hasActiveSettlementDependents("book", "account" as never)
    ).resolves.toBe(false)
  })

  it("checks only active investment accounts for settlement dependents", async () => {
    const { reader, queries } = readerFor({})
    await new SqliteInvestmentTransactionReads(
      reader
    ).hasActiveSettlementDependents("book", "account" as never)
    expect(queries[0]?.sql).toContain("a.status = 'ACTIVE'")
  })

  it("returns the exact account ledger balance", async () => {
    const { reader } = readerFor({
      postings: [{ posting_id: "a", amount_minor: "9007199254740993" }],
    })
    await expect(
      new SqliteInvestmentTransactionReads(reader).accountLedgerBalance(
        "book",
        "account" as never
      )
    ).resolves.toBe("9007199254740993")
  })

  it("applies the inclusive date to an account ledger balance", async () => {
    const { reader, queries } = readerFor({})
    await new SqliteInvestmentTransactionReads(reader).accountLedgerBalance(
      "book",
      "account" as never,
      "2026-08-04"
    )
    expect(queries[0]?.parameters).toContain("2026-08-04")
  })

  it("returns no cash states for no investment accounts", async () => {
    const { reader, queries } = readerFor({})
    await expect(
      new SqliteInvestmentTransactionReads(reader).accountCash(
        "book",
        [],
        "2026-08-04"
      )
    ).resolves.toEqual([])
    expect(queries).toHaveLength(0)
  })

  it("subtracts allocated cost from the ledger balance", async () => {
    const { reader } = readerFor({
      postings: [{ posting_id: "a", amount_minor: "1000" }],
      costs: [{ investment_account_id: "account", book_cost_minor: "700" }],
    })
    await expect(
      new SqliteInvestmentTransactionReads(reader).accountCash(
        "book",
        ["account" as never],
        "2026-08-04"
      )
    ).resolves.toEqual([
      { investmentAccountId: "account", cashMinor: "300", currency: "BRL" },
    ])
  })

  it("preserves negative investment cash as a warning input", async () => {
    const { reader } = readerFor({
      postings: [{ posting_id: "a", amount_minor: "100" }],
      costs: [{ investment_account_id: "account", book_cost_minor: "200" }],
    })
    await expect(
      new SqliteInvestmentTransactionReads(reader).accountCash(
        "book",
        ["account" as never],
        "2026-08-04"
      )
    ).resolves.toEqual([
      { investmentAccountId: "account", cashMinor: "-100", currency: "BRL" },
    ])
  })

  it("keeps independent cash states for every requested investment account", async () => {
    const { reader } = readerFor({
      costs: [{ investment_account_id: "a", book_cost_minor: "2" }],
    })
    await expect(
      new SqliteInvestmentTransactionReads(reader).accountCash(
        "book",
        ["a", "b"] as never,
        "2026-08-04"
      )
    ).resolves.toEqual([
      { investmentAccountId: "a", cashMinor: "-2", currency: "BRL" },
      { investmentAccountId: "b", cashMinor: "0", currency: "BRL" },
    ])
  })

  it("uses the book base currency for cash state", async () => {
    const { reader } = readerFor({ currency: "USD" })
    await expect(
      new SqliteInvestmentTransactionReads(reader).accountCash(
        "book",
        ["account" as never],
        "2026-08-04"
      )
    ).resolves.toEqual([
      { investmentAccountId: "account", cashMinor: "0", currency: "USD" },
    ])
  })

  it("does not add an as-of predicate when the ledger balance is current", async () => {
    const { reader, queries } = readerFor({})
    await new SqliteInvestmentTransactionReads(reader).accountLedgerBalance(
      "book",
      "account" as never
    )
    expect(queries[0]?.sql).not.toContain("e.occurred_on <= ?")
  })

  it("binds the requested account ids when it reads allocated costs", async () => {
    const { reader, queries } = readerFor({})
    await new SqliteInvestmentTransactionReads(reader).accountCash(
      "book",
      ["account" as never],
      "2026-08-04"
    )
    const costs = queries.find((query) =>
      query.sql.includes("FROM investment_positions")
    )
    expect(costs?.parameters).toEqual(["book", "account"])
  })
})
