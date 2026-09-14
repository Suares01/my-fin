import {
  CreateFinancialAccount,
  RecordExpense,
  RecordIncome,
  ReverseJournalEntry,
  SetOpeningBalance,
  TransferMoney,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  createBook,
  createExpenseCategory,
  createHarness,
  createIncomeCategory,
  createFinancialAccount,
} from "./test-helpers.js"

describe("Journal ordering metadata", () => {
  it("persists the fixed clock instant and a sequence for every journal command", async () => {
    const harness = createHarness()
    await createBook(harness)
    await createFinancialAccount(harness)
    const destination = await new CreateFinancialAccount(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids
    ).execute({ bookId: "book-1", name: "Savings", type: "OTHER_ASSET" })
    expect(destination.ok).toBe(true)
    await createExpenseCategory(harness)
    await createIncomeCategory(harness)

    const opening = await new SetOpeningBalance(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids,
      harness.clock
    ).execute({
      bookId: "book-1",
      accountId: "account-5",
      amountMinor: "10000",
      currency: "BRL",
      occurredOn: "2026-08-01",
      description: "Opening",
    })
    expect(opening.ok).toBe(true)

    const expense = await new RecordExpense(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids,
      harness.clock
    ).execute({
      bookId: "book-1",
      accountId: "account-5",
      categoryId: "account-7",
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-08-02",
      description: "Expense",
    })
    expect(expense.ok).toBe(true)

    const income = await new RecordIncome(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids,
      harness.clock
    ).execute({
      bookId: "book-1",
      accountId: "account-5",
      categoryId: "account-8",
      amountMinor: "2000",
      currency: "BRL",
      occurredOn: "2026-08-03",
      description: "Income",
    })
    expect(income.ok).toBe(true)

    const transfer = await new TransferMoney(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids,
      harness.clock
    ).execute({
      bookId: "book-1",
      sourceAccountId: "account-5",
      destinationAccountId: "account-6",
      amountMinor: "500",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Transfer",
    })
    expect(transfer.ok).toBe(true)

    const reversal = await new ReverseJournalEntry(
      harness.transactionManager,
      harness.dispatcher,
      harness.ids,
      harness.clock
    ).execute({
      bookId: "book-1",
      journalEntryId: "entry-4",
      expectedVersion: 0,
      occurredOn: "2026-08-05",
      description: "Reverse transfer",
    })
    expect(reversal.ok).toBe(true)

    expect(
      harness.store.listJournalEntries().map(({ recordedAt, sequence }) => ({
        recordedAt,
        sequence,
      }))
    ).toEqual([
      { recordedAt: "2026-08-04T12:00:00.000Z", sequence: "1" },
      { recordedAt: "2026-08-04T12:00:00.000Z", sequence: "2" },
      { recordedAt: "2026-08-04T12:00:00.000Z", sequence: "3" },
      { recordedAt: "2026-08-04T12:00:00.000Z", sequence: "4" },
      { recordedAt: "2026-08-04T12:00:00.000Z", sequence: "5" },
    ])
  })
})
