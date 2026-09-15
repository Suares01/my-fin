import { LocalDate } from "@workspace/domain"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SqliteInsightQueries } from "../../src/queries/sqlite-insight-queries.js"
import {
  createFinancialQueryScenario,
  type FinancialQueryScenario,
} from "../support/financial-query-scenario.js"

describe("SqliteInsightQueries.getNetWorth", () => {
  let scenario: FinancialQueryScenario
  let queries: SqliteInsightQueries
  let assetId: string
  let liabilityId: string
  let expenseId: string

  beforeEach(async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    assetId = (await scenario.createFinancialAccount({ name: "Cash" })).id
    liabilityId = (
      await scenario.createFinancialAccount({ name: "Card", kind: "LIABILITY" })
    ).id
    expenseId = (await scenario.createExpenseCategory()).id
    queries = new SqliteInsightQueries(scenario.database)
  })

  afterEach(async () => scenario.close())

  it("aggregates displayed assets and liabilities with the exact equation", async () => {
    await scenario.setOpeningBalance({
      accountId: assetId,
      amountMinor: "100",
      occurredOn: "2026-08-01",
    })
    await scenario.setOpeningBalance({
      accountId: liabilityId,
      amountMinor: "200",
      occurredOn: "2026-08-01",
    })

    await expect(
      queries.getNetWorth({ bookId: "book-1" as never })
    ).resolves.toEqual({
      assetMinor: "100",
      liabilityMinor: "200",
      netWorthMinor: "-100",
      currency: "BRL",
      asOf: null,
    })
  })

  it("keeps archived account balances in the result", async () => {
    await scenario.setOpeningBalance({ accountId: assetId, amountMinor: "75" })
    await scenario.archiveAccount(assetId)

    const result = await queries.getNetWorth({ bookId: "book-1" as never })

    expect(result.assetMinor).toBe("75")
  })

  it("applies an inclusive historical date", async () => {
    await scenario.setOpeningBalance({
      accountId: assetId,
      amountMinor: "100",
      occurredOn: "2026-08-01",
    })
    await scenario.setOpeningBalance({
      accountId: liabilityId,
      amountMinor: "200",
      occurredOn: "2026-08-01",
    })
    await scenario.recordExpense({
      accountId: assetId,
      categoryId: expenseId,
      amountMinor: "25",
      occurredOn: "2026-08-10",
    })

    const historical = await queries.getNetWorth({
      bookId: "book-1" as never,
      asOf: LocalDate.parse("2026-08-05"),
    })
    const current = await queries.getNetWorth({
      bookId: "book-1" as never,
      asOf: LocalDate.parse("2026-08-10"),
    })
    const omitted = await queries.getNetWorth({ bookId: "book-1" as never })

    expect(historical).toEqual({
      assetMinor: "100",
      liabilityMinor: "200",
      netWorthMinor: "-100",
      currency: "BRL",
      asOf: "2026-08-05",
    })
    expect(current).toEqual({
      assetMinor: "75",
      liabilityMinor: "200",
      netWorthMinor: "-125",
      currency: "BRL",
      asOf: "2026-08-10",
    })
    expect(omitted).toEqual({
      assetMinor: "75",
      liabilityMinor: "200",
      netWorthMinor: "-125",
      currency: "BRL",
      asOf: null,
    })
  })

  it("includes an archived liability and a negative displayed liability", async () => {
    const archivedLiabilityId = (
      await scenario.createFinancialAccount({
        name: "Archived liability",
        kind: "LIABILITY",
      })
    ).id
    await scenario.recordExpense({
      accountId: archivedLiabilityId,
      categoryId: expenseId,
      amountMinor: "75",
    })
    await scenario.archiveAccount(archivedLiabilityId)
    await scenario.transfer({
      sourceAccountId: assetId,
      destinationAccountId: liabilityId,
      amountMinor: "200",
    })

    await expect(
      queries.getNetWorth({ bookId: "book-1" as never })
    ).resolves.toEqual({
      assetMinor: "-200",
      liabilityMinor: "-125",
      netWorthMinor: "-75",
      currency: "BRL",
      asOf: null,
    })
  })

  it("preserves negative balances and int64 strings", async () => {
    await scenario.setOpeningBalance({ accountId: assetId, amountMinor: "1" })
    await scenario.recordExpense({
      accountId: assetId,
      categoryId: expenseId,
      amountMinor: "9007199254740994",
    })
    await scenario.setOpeningBalance({
      accountId: liabilityId,
      amountMinor: "9007199254740993",
    })

    const result = await queries.getNetWorth({ bookId: "book-1" as never })

    expect(result).toEqual(
      expect.objectContaining({
        assetMinor: "-9007199254740993",
        liabilityMinor: "9007199254740993",
        netWorthMinor: "-18014398509481986",
      })
    )
  })

  it("returns zeroes for a book without financial activity", async () => {
    const result = await queries.getNetWorth({ bookId: "book-1" as never })

    expect(result).toEqual({
      assetMinor: "0",
      liabilityMinor: "0",
      netWorthMinor: "0",
      currency: "BRL",
      asOf: null,
    })
  })

  it("uses a bounded consistent exact read", async () => {
    await scenario.setOpeningBalance({ accountId: assetId, amountMinor: "10" })
    const querySpy = vi.spyOn(scenario.database, "queryOnConnection")

    await expect(queries.getNetWorth({ bookId: "book-1" as never })).resolves.toMatchObject({ assetMinor: "10", netWorthMinor: "10" })

    expect(querySpy).toHaveBeenCalledTimes(2)
  })

  it("returns the requested book currency", async () => {
    const result = await queries.getNetWorth({ bookId: "book-1" as never })
    expect(result.currency).toBe("BRL")
  })

  it("does not expose a missing book", async () => {
    await expect(
      queries.getNetWorth({ bookId: "missing" as never })
    ).rejects.toThrow("Financial book missing was not found")
  })
})
