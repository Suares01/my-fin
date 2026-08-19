import {
  CreateFinancialAccount,
  RecordExpense,
  TransferMoney,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { InMemoryLedgerQueries } from "../queries/in-memory-ledger-queries.js"
import {
  createBook,
  createExpenseCategory,
  createFinancialAccount,
  createHarness,
} from "./test-helpers.js"

describe("financial account kind matrix", () => {
  it.each(["ASSET", "LIABILITY"] as const)(
    "records an expense from a %s account with the category debit",
    async (kind) => {
      const harness = createHarness()
      await createBook(harness)
      await createFinancialAccount(harness, kind)
      await createExpenseCategory(harness)

      const result = await new RecordExpense(
        harness.transactionManager,
        harness.dispatcher,
        harness.ids,
        harness.clock
      ).execute({
        bookId: "book-1",
        accountId: "account-5",
        categoryId: "account-6",
        amountMinor: "1000",
        currency: "BRL",
        occurredOn: "2026-08-04",
        description: "Expense",
      })

      expect(result.ok).toBe(true)
      expect(
        harness.store
          .listJournalEntries()[0]
          ?.postings.map(({ accountId, amountMinor }) => ({
            accountId,
            amountMinor,
          }))
      ).toEqual([
        { accountId: "account-6", amountMinor: 1000n },
        { accountId: "account-5", amountMinor: -1000n },
      ])

      const queries = new InMemoryLedgerQueries(harness.store)
      expect(
        (
          await queries.getAccountBalance({
            bookId: "book-1" as never,
            accountId: "account-5" as never,
          })
        ).amountMinor
      ).toBe(kind === "ASSET" ? "-1000" : "1000")
      expect(
        (
          await queries.getAccountBalance({
            bookId: "book-1" as never,
            accountId: "account-6" as never,
          })
        ).amountMinor
      ).toBe("1000")
    }
  )

  it.each([
    ["ASSET", "ASSET"],
    ["ASSET", "LIABILITY"],
    ["LIABILITY", "ASSET"],
    ["LIABILITY", "LIABILITY"],
  ] as const)(
    "transfers from %s to %s with only financial postings",
    async (sourceKind, destinationKind) => {
      const harness = createHarness()
      await createBook(harness)
      await createFinancialAccount(harness, sourceKind)
      const destination = await new CreateFinancialAccount(
        harness.transactionManager,
        harness.dispatcher,
        harness.ids
      ).execute({
        bookId: "book-1",
        name: "Destination",
        kind: destinationKind,
      })
      expect(destination.ok).toBe(true)

      const result = await new TransferMoney(
        harness.transactionManager,
        harness.dispatcher,
        harness.ids,
        harness.clock
      ).execute({
        bookId: "book-1",
        sourceAccountId: "account-5",
        destinationAccountId: "account-6",
        amountMinor: "1000",
        currency: "BRL",
        occurredOn: "2026-08-04",
        description: "Transfer",
      })

      expect(result.ok).toBe(true)
      const entry = harness.store.listJournalEntries()[0]
      expect(
        entry?.postings.map(({ accountId, amountMinor }) => ({
          accountId,
          amountMinor,
        }))
      ).toEqual([
        { accountId: "account-5", amountMinor: -1000n },
        { accountId: "account-6", amountMinor: 1000n },
      ])
      expect(
        entry?.postings.every((posting) => {
          const account = harness.store.getAccount(posting.accountId as never)
          return account?.kind !== "INCOME" && account?.kind !== "EXPENSE"
        })
      ).toBe(true)

      const queries = new InMemoryLedgerQueries(harness.store)
      expect(
        (
          await queries.getAccountBalance({
            bookId: "book-1" as never,
            accountId: "account-5" as never,
          })
        ).amountMinor
      ).toBe(sourceKind === "ASSET" ? "-1000" : "1000")
      expect(
        (
          await queries.getAccountBalance({
            bookId: "book-1" as never,
            accountId: "account-6" as never,
          })
        ).amountMinor
      ).toBe(destinationKind === "ASSET" ? "1000" : "-1000")
    }
  )
})
