import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import * as api from "./index.js"
import { describe, expect, it } from "vitest"

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : []
  })
}

describe("application public query API", () => {
  it("exports the ledger read handlers", () => {
    expect(api.GetAccountBalance).toBeTypeOf("function")
    expect(api.ListAccountBalances).toBeTypeOf("function")
    expect(api.ListAccountStatement).toBeTypeOf("function")
    expect(api.ListJournalEntries).toBeTypeOf("function")
    expect(api.ListJournalChains).toBeTypeOf("function")
    expect(api.GetJournalChainDetail).toBeTypeOf("function")
    expect(api.GetMonthlyCashFlow).toBeTypeOf("function")
    expect(api.GetCategorySpending).toBeTypeOf("function")
    expect(api.GetNetWorth).toBeTypeOf("function")
  })

  it("exports the completion commands without exposing test drivers", () => {
    expect(api.RecordIncome).toBeTypeOf("function")
    expect(api.TransferMoney).toBeTypeOf("function")
    expect(api.ReverseJournalEntry).toBeTypeOf("function")
    expect(api.AmendJournalEntry).toBeTypeOf("function")
    expect(api.RenameLedgerAccount).toBeTypeOf("function")
    expect(api.ArchiveLedgerAccount).toBeTypeOf("function")
    expect(api.ReactivateLedgerAccount).toBeTypeOf("function")
    expect(Object.keys(api)).not.toContain("FixedClock")
    expect(Object.keys(api)).not.toContain("SequentialIdGenerator")
  })

  it("exports the catalog handlers without exposing infrastructure adapters", () => {
    expect(api.ListFinancialBooks).toBeTypeOf("function")
    expect(api.ListExpenseCategories).toBeTypeOf("function")
    expect(Object.keys(api)).not.toContain("SqliteBookCatalogQueries")
    expect(Object.keys(api)).not.toContain("SqliteCategoryCatalogQueries")
  })

  it("keeps the application source graph independent from SQLite infrastructure", () => {
    const forbiddenPackage = ["@workspace", "infrastructure-sqlite"].join("/")
    const applicationSource = sourceFiles(
      new URL(".", import.meta.url).pathname
    )
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")

    expect(applicationSource).not.toContain(forbiddenPackage)
  })
})
