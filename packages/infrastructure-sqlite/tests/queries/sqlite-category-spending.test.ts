import { LocalDate } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SqliteInsightQueries } from "../../src/queries/sqlite-insight-queries.js"
import {
  createFinancialQueryScenario,
  type FinancialQueryScenario,
} from "../support/financial-query-scenario.js"

describe("SqliteInsightQueries.getCategorySpending", () => {
  let scenario: FinancialQueryScenario
  let queries: SqliteInsightQueries
  let cashId: string
  let foodId: string
  let travelId: string

  beforeEach(async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    cashId = (await scenario.createFinancialAccount()).id
    foodId = (await scenario.createExpenseCategory("Food")).id
    travelId = (await scenario.createExpenseCategory("Travel")).id
    queries = new SqliteInsightQueries(scenario.database)
  })

  afterEach(async () => scenario.close())

  const input = (
    overrides: Partial<{ from: string; to: string; categoryId: string }> = {}
  ) => ({
    bookId: "book-1" as never,
    from: LocalDate.parse(overrides.from ?? "2026-08-01"),
    to: LocalDate.parse(overrides.to ?? "2026-08-31"),
    ...(overrides.categoryId === undefined
      ? {}
      : { categoryId: overrides.categoryId as never }),
  })

  it("aggregates split postings per category with exact amounts", async () => {
    await scenario.addSplit({
      accountId: cashId,
      categories: [
        { accountId: foodId, amountMinor: "70" },
        { accountId: travelId, amountMinor: "30" },
      ],
    })

    const result = await queries.getCategorySpending(input())

    expect(
      result.map(({ categoryName, amountMinor }) => ({
        categoryName,
        amountMinor,
      }))
    ).toEqual([
      { categoryName: "Food", amountMinor: "70" },
      { categoryName: "Travel", amountMinor: "30" },
    ])
  })

  it("keeps archived categories and counts only original positive entries", async () => {
    const original = await scenario.recordExpense({
      accountId: cashId,
      categoryId: foodId,
      amountMinor: "100",
    })
    await scenario.reverse({
      journalEntryId: original,
      occurredOn: "2026-08-10",
    })
    await scenario.archiveAccount(foodId)

    const result = await queries.getCategorySpending(input())

    expect(result).toEqual([
      {
        categoryId: foodId,
        categoryName: "Food",
        amountMinor: "0",
        transactionCount: 1,
        archived: true,
        percentageBasisPoints: 0,
      },
    ])
  })

  it("uses net positive amounts for truncated basis points", async () => {
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: foodId,
      amountMinor: "2",
    })
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: travelId,
      amountMinor: "1",
    })

    const result = await queries.getCategorySpending(input())

    expect(
      result.map(({ categoryName, percentageBasisPoints }) => ({
        categoryName,
        percentageBasisPoints,
      }))
    ).toEqual([
      { categoryName: "Food", percentageBasisPoints: 6666 },
      { categoryName: "Travel", percentageBasisPoints: 3333 },
    ])
  })

  it("returns only the exact requested category", async () => {
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: foodId,
      amountMinor: "10",
    })
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: travelId,
      amountMinor: "20",
    })

    const result = await queries.getCategorySpending(
      input({ categoryId: foodId })
    )

    expect(result.map(({ categoryId }) => categoryId)).toEqual([foodId])
  })

  it("returns an empty list for an empty period", async () => {
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: foodId,
      amountMinor: "10",
      occurredOn: "2026-07-31",
    })

    await expect(queries.getCategorySpending(input())).resolves.toEqual([])
  })

  it("orders ties by category name and then ID", async () => {
    const firstId = (await scenario.createExpenseCategory("Same first")).id
    const secondId = (await scenario.createExpenseCategory("Same second")).id
    await scenario.database.execute(
      "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND id = ?",
      ["Same", "book-1", firstId]
    )
    await scenario.database.execute(
      "UPDATE ledger_accounts SET name = ? WHERE book_id = ? AND id = ?",
      ["Same", "book-1", secondId]
    )
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: secondId,
      amountMinor: "10",
    })
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: firstId,
      amountMinor: "10",
    })

    const result = await queries.getCategorySpending(input())

    expect(
      result
        .filter(({ categoryName }) => categoryName === "Same")
        .map(({ categoryId }) => categoryId)
    ).toEqual([firstId, secondId])
  })

  it("preserves signed int64 amounts as decimal strings", async () => {
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: foodId,
      amountMinor: "9007199254740993",
    })

    const result = await queries.getCategorySpending(input())

    expect(result[0]?.amountMinor).toBe("9007199254740993")
  })

  it("uses one aggregate statement regardless of item count", async () => {
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: foodId,
      amountMinor: "10",
    })
    await scenario.recordExpense({
      accountId: cashId,
      categoryId: travelId,
      amountMinor: "20",
    })
    const querySpy = vi.spyOn(scenario.database, "query")

    await queries.getCategorySpending(input())

    expect(querySpy).toHaveBeenCalledTimes(1)
  })

  it("does not mix a different book", async () => {
    const otherScenario = await createFinancialQueryScenario()
    await otherScenario.createBook()
    const otherCash = (await otherScenario.createFinancialAccount()).id
    const otherCategory = (await otherScenario.createExpenseCategory("Other"))
      .id
    await otherScenario.recordExpense({
      accountId: otherCash,
      categoryId: otherCategory,
      amountMinor: "99",
    })

    await expect(queries.getCategorySpending(input())).resolves.toEqual([])
    await otherScenario.close()
  })
})
