import type { JournalChainListItem, QueryPage } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  dedupeTransactionChainPages,
  filterTransactionChainsByStatus,
  normalizeTransactionServerFilters,
  normalizeTransactionSummaryFilters,
  summarizeTransactionChains,
  transactionAmountSign,
  type TransactionFilters,
} from "./transaction-list-model.js"

const filters: TransactionFilters = {
  from: "",
  to: "",
  search: "",
  types: ["INCOME", "EXPENSE", "TRANSFER"],
  accountIds: [],
  categoryIds: [],
  status: "ALL",
}

function chain(
  overrides: Partial<JournalChainListItem> = {}
): JournalChainListItem {
  return {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    type: "INCOME",
    status: "ACTIVE",
    occurredOn: "2026-09-03",
    recordedAt: "2026-09-03T12:00:00.000Z",
    sequence: "1",
    description: "Receita",
    origin: "MANUAL",
    amountMinor: "100",
    currency: "BRL",
    financialAccounts: [],
    categories: [],
    ...overrides,
  }
}

describe("transaction list model", () => {
  it("normalizes supported server filters and excludes local status", () => {
    expect(
      normalizeTransactionServerFilters({
        ...filters,
        from: " 2026-01-01 ",
        to: " 2026-01-31 ",
        search: "  Café ",
        status: "CANCELLED",
      })
    ).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
      search: "café",
      types: ["EXPENSE", "INCOME", "TRANSFER"],
    })
  })

  it("omits empty server filter fields", () => {
    expect(normalizeTransactionServerFilters(filters)).toEqual({
      types: ["EXPENSE", "INCOME", "TRANSFER"],
    })
  })

  it("omits ALL status from summary filters", () => {
    expect(normalizeTransactionSummaryFilters(filters)).toEqual({
      types: ["EXPENSE", "INCOME", "TRANSFER"],
    })
  })

  it("includes a selected status only in summary filters", () => {
    const selected = { ...filters, status: "CANCELLED" as const }

    expect(normalizeTransactionServerFilters(selected)).not.toHaveProperty(
      "status"
    )
    expect(normalizeTransactionSummaryFilters(selected)).toEqual({
      types: ["EXPENSE", "INCOME", "TRANSFER"],
      status: "CANCELLED",
    })
  })

  it("sorts and deduplicates type and identifier filters", () => {
    expect(
      normalizeTransactionServerFilters({
        ...filters,
        types: ["TRANSFER", "INCOME", "TRANSFER"],
        accountIds: [" account-2 ", "account-1", "account-2"],
        categoryIds: ["category-2", "category-1", "category-1"],
      })
    ).toEqual({
      types: ["INCOME", "TRANSFER"],
      accountIds: ["account-1", "account-2"],
      categoryIds: ["category-1", "category-2"],
    })
  })

  it("deduplicates overlapping pages by chain identity while preserving server order", () => {
    const pages: readonly QueryPage<JournalChainListItem>[] = [
      { items: [chain(), chain({ chainId: "chain-2" })], nextCursor: "next" },
      {
        items: [
          chain({ chainId: "chain-2", presentedEntryId: "entry-2" }),
          chain({ chainId: "chain-3" }),
        ],
        nextCursor: null,
      },
    ]
    expect(
      dedupeTransactionChainPages(pages).map((item) => item.chainId)
    ).toEqual(["chain-1", "chain-2", "chain-3"])
  })

  it("keeps every loaded chain for the ALL status selection", () => {
    const items = [chain(), chain({ chainId: "chain-2", status: "EDITED" })]
    expect(filterTransactionChainsByStatus(items, "ALL")).toBe(items)
  })

  it("filters only loaded chains by the selected chain status", () => {
    const items = [chain(), chain({ chainId: "chain-2", status: "CANCELLED" })]
    expect(filterTransactionChainsByStatus(items, "CANCELLED")).toEqual([
      items[1],
    ])
  })

  it("presents income values with a positive sign", () => {
    expect(transactionAmountSign("INCOME")).toBe("+")
  })

  it("presents expense values with a negative sign", () => {
    expect(transactionAmountSign("EXPENSE")).toBe("-")
  })

  it("presents transfer values without a directional sign", () => {
    expect(transactionAmountSign("TRANSFER")).toBe("")
  })

  it("sums only income magnitudes as a positive BigInt total", () => {
    expect(
      summarizeTransactionChains([chain({ amountMinor: "9007199254740993" })])
        .incomeMinor
    ).toBe(9007199254740993n)
  })

  it("sums expense magnitudes as a negative total and excludes transfers", () => {
    expect(
      summarizeTransactionChains([
        chain({ type: "EXPENSE", amountMinor: "250" }),
        chain({ chainId: "chain-2", type: "TRANSFER", amountMinor: "900" }),
      ])
    ).toMatchObject({ incomeMinor: 0n, expenseMinor: -250n })
  })

  it("counts transfers and finds the largest absolute loaded magnitude", () => {
    expect(
      summarizeTransactionChains([
        chain({ amountMinor: "100" }),
        chain({
          chainId: "chain-2",
          type: "TRANSFER",
          amountMinor: "9007199254740993",
        }),
      ])
    ).toMatchObject({ count: 2, largestAbsoluteMinor: 9007199254740993n })
  })
})
