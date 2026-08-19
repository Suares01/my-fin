import { afterEach, describe, expect, it } from "vitest"
import {
  createFinancialQueryScenario,
  type FinancialQueryScenario,
} from "./financial-query-scenario.js"

describe("financial query scenario builder", () => {
  let scenario: FinancialQueryScenario | undefined

  afterEach(async () => {
    await scenario?.close()
    scenario = undefined
  })

  it("creates the common book, opening, income, expense and transfer flow", async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    const checking = await scenario.createFinancialAccount()
    const savings = await scenario.createFinancialAccount({ name: "Savings" })
    const food = await scenario.createExpenseCategory()
    const salary = await scenario.createIncomeCategory()

    const openingId = await scenario.setOpeningBalance({
      accountId: checking.id,
      amountMinor: "10000",
    })
    const incomeId = await scenario.recordIncome({
      accountId: checking.id,
      categoryId: salary.id,
      amountMinor: "2500",
      description: "Salary",
    })
    const expenseId = await scenario.recordExpense({
      accountId: checking.id,
      categoryId: food.id,
      amountMinor: "700",
      description: "Lunch",
    })
    const transferId = await scenario.transfer({
      sourceAccountId: checking.id,
      destinationAccountId: savings.id,
      amountMinor: "300",
    })

    expect([openingId, incomeId, expenseId, transferId]).toEqual([
      "entry-1",
      "entry-2",
      "entry-3",
      "entry-4",
    ])
    expect(scenario.publisher.events).toEqual([])
    await expect(scenario.snapshot(expenseId)).resolves.toMatchObject({
      description: "Lunch",
      postings: [
        { accountId: food.id, amountMinor: 700n },
        { accountId: checking.id, amountMinor: -700n },
      ],
    })
  })

  it("creates a liability purchase and a separate liability payment", async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    const checking = await scenario.createFinancialAccount()
    const creditCard = await scenario.createFinancialAccount({
      kind: "LIABILITY",
      name: "Credit card",
    })
    const food = await scenario.createExpenseCategory()

    const purchaseId = await scenario.recordExpense({
      accountId: creditCard.id,
      categoryId: food.id,
      amountMinor: "1200",
      description: "Card purchase",
    })
    const paymentId = await scenario.transfer({
      sourceAccountId: checking.id,
      destinationAccountId: creditCard.id,
      amountMinor: "1200",
      description: "Card payment",
    })

    expect(await scenario.snapshot(purchaseId)).toMatchObject({
      postings: [
        { accountId: food.id, amountMinor: 1200n },
        { accountId: creditCard.id, amountMinor: -1200n },
      ],
    })
    expect(await scenario.snapshot(paymentId)).toMatchObject({
      postings: [
        { accountId: checking.id, amountMinor: -1200n },
        { accountId: creditCard.id, amountMinor: 1200n },
      ],
    })
    expect(scenario.publisher.events).toEqual([])
  })

  it("builds a valid split through domain postings and repositories", async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    const checking = await scenario.createFinancialAccount()
    const food = await scenario.createExpenseCategory("Food")
    const transport = await scenario.createExpenseCategory("Transport")

    const entryId = await scenario.addSplit({
      accountId: checking.id,
      categories: [
        { accountId: food.id, amountMinor: "100" },
        { accountId: transport.id, amountMinor: "35" },
      ],
      description: "Market and bus",
    })

    await expect(scenario.snapshot(entryId)).resolves.toMatchObject({
      description: "Market and bus",
      postings: [
        { accountId: food.id, amountMinor: 100n },
        { accountId: transport.id, amountMinor: 35n },
        { accountId: checking.id, amountMinor: -135n },
      ],
    })
    expect(scenario.publisher.events).toEqual([])
  })

  it("preserves reversal links and archived account snapshots", async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    const checking = await scenario.createFinancialAccount()
    const food = await scenario.createExpenseCategory()
    const originalId = await scenario.recordExpense({
      accountId: checking.id,
      categoryId: food.id,
      amountMinor: "900",
      description: "Reversed lunch",
    })

    const reversalId = await scenario.reverse({
      journalEntryId: originalId,
      occurredOn: "2026-08-05",
      description: "Corrected lunch",
    })
    await scenario.archiveAccount(food.id)

    await expect(scenario.snapshot(originalId)).resolves.toMatchObject({
      reversedBy: reversalId,
      version: 1,
    })
    await expect(scenario.snapshot(reversalId)).resolves.toMatchObject({
      reversalOf: originalId,
      origin: "SYSTEM",
      postings: [
        { accountId: food.id, amountMinor: -900n },
        { accountId: checking.id, amountMinor: 900n },
      ],
    })
    await expect(
      scenario.accounts.findById(food.id as never)
    ).resolves.toMatchObject({
      status: "ARCHIVED",
      version: 1,
    })
    expect(scenario.publisher.events).toEqual([])
  })
})
