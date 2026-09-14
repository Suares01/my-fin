import {
  AmendJournalEntry,
  CreateExpenseCategory,
  CreateFinancialAccount,
  CreateIncomeCategory,
  CreateInvestmentInstrument,
  OpenInvestmentPosition,
  RecordExpense,
  RecordIncome,
  ReverseJournalEntry,
  SetOpeningBalance,
  TransferMoney,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"

async function setup(twoBrokers = false) {
  const h = createHarness()
  await createBook(h)
  const broker = await account(h, "Broker", "INVESTMENT_ACCOUNT")
  const second = twoBrokers
    ? await account(h, "Second broker", "INVESTMENT_ACCOUNT")
    : undefined
  const bank = await account(h, "Bank", "BANK_ACCOUNT")
  const expense = await category(h, "Expense", "EXPENSE")
  const income = await category(h, "Income", "INCOME")
  const instrument = await new CreateInvestmentInstrument(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "CDB", type: "CDB", currency: "BRL" })
  if (!instrument.ok) throw new Error("fixture failed")
  await open(h, broker.id, instrument.value.id, "open-one")
  if (second !== undefined)
    await open(h, second.id, instrument.value.id, "open-two")
  h.publisher.clear()
  return { h, broker, second, bank, expense, income }
}

async function account(
  h: ReturnType<typeof createHarness>,
  name: string,
  type: "INVESTMENT_ACCOUNT" | "BANK_ACCOUNT"
) {
  const result = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name, type })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

async function category(
  h: ReturnType<typeof createHarness>,
  name: string,
  kind: "INCOME" | "EXPENSE"
) {
  const Command =
    kind === "INCOME" ? CreateIncomeCategory : CreateExpenseCategory
  const result = await new Command(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({
    bookId: "book-1",
    name,
    kind,
    iconKey: "chart",
    colorHex: "10b981",
  })
  if (!result.ok) throw new Error("fixture failed")
  return result.value
}

async function open(
  h: ReturnType<typeof createHarness>,
  investmentAccountId: string,
  instrumentId: string,
  requestId: string
) {
  const result = await new OpenInvestmentPosition(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  ).execute({
    bookId: "book-1",
    requestId,
    investmentAccountId,
    instrumentId,
    quantityMode: "UNITS",
    quantity: "10",
    bookCostMinor: "1000",
    occurredOn: "2026-08-04",
  })
  if (!result.ok) throw new Error("fixture failed")
}

function warning(id: string, cashMinor: string) {
  return [
    {
      code: "INVESTMENT_CASH_NEGATIVE",
      investmentAccountId: id,
      cashMinor,
      currency: "BRL",
      asOf: "2026-08-04",
    },
  ]
}

describe("investment cash warnings for common journal commands", () => {
  it("adds a warning to generic expense without blocking its journal", async () => {
    const f = await setup()
    const result = await new RecordExpense(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      categoryId: f.expense.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Fee",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-1100") },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("adds a warning to generic income using the resulting cash", async () => {
    const f = await setup()
    const result = await new RecordIncome(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      categoryId: f.income.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Income",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-900") },
    })
  })

  it("omits the warning after generic income restores nonnegative cash", async () => {
    const f = await setup()
    const result = await new RecordIncome(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      categoryId: f.income.id,
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Income",
    })
    expect(result).toMatchObject({ ok: true, value: { id: "entry-1" } })
    expect(result.ok && result.value.warnings).toBeUndefined()
  })

  it("adds a warning to an opening balance that still leaves allocated cash negative", async () => {
    const f = await setup()
    const result = await new SetOpeningBalance(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Opening",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-900") },
    })
  })

  it("removes the warning when an opening balance covers the allocated cost", async () => {
    const f = await setup()
    const result = await new SetOpeningBalance(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Opening",
    })
    expect(result.ok && result.value.warnings).toBeUndefined()
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("warns every affected investment account in a transfer", async () => {
    const f = await setup(true)
    const result = await new TransferMoney(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      sourceAccountId: f.broker.id,
      destinationAccountId: f.second!.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Move",
    })
    expect(result).toMatchObject({
      ok: true,
      value: {
        warnings: [
          warning(f.broker.id, "-1100")[0],
          warning(f.second!.id, "-900")[0],
        ],
      },
    })
  })

  it("warns only the affected investment side of a transfer", async () => {
    const f = await setup()
    const result = await new TransferMoney(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      sourceAccountId: f.broker.id,
      destinationAccountId: f.bank.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Move",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-1100") },
    })
  })

  it("keeps transfer warnings free of duplicates when both postings share one investment account", async () => {
    const f = await setup()
    const result = await new TransferMoney(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      sourceAccountId: f.broker.id,
      destinationAccountId: f.bank.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Move",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-1100") },
    })
  })

  it("adds a warning to a generic reversal without creating investment operations", async () => {
    const f = await setup()
    const expense = await new RecordExpense(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      categoryId: f.expense.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Fee",
    })
    if (!expense.ok) throw new Error("fixture failed")
    const result = await new ReverseJournalEntry(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      journalEntryId: expense.value.id,
      expectedVersion: 0,
      occurredOn: "2026-08-04",
      description: "Undo",
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-1000") },
    })
    expect(f.h.store.listInvestmentOperations()).toHaveLength(1)
  })

  it("adds a warning to a generic amendment based on the final postings", async () => {
    const f = await setup()
    const expense = await new RecordExpense(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.broker.id,
      categoryId: f.expense.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Fee",
    })
    if (!expense.ok) throw new Error("fixture failed")
    const result = await new AmendJournalEntry(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      journalEntryId: expense.value.id,
      expectedVersion: 0,
      replacement: {
        type: "EXPENSE",
        accountId: f.broker.id,
        categoryId: f.expense.id,
        amountMinor: "200",
        currency: "BRL",
        occurredOn: "2026-08-04",
        description: "Corrected fee",
      },
    })
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: warning(f.broker.id, "-1200") },
    })
  })

  it("does not attach a warning to an ordinary financial account", async () => {
    const f = await setup()
    const result = await new RecordExpense(
      f.h.transactionManager,
      f.h.dispatcher,
      f.h.ids,
      f.h.clock
    ).execute({
      bookId: "book-1",
      accountId: f.bank.id,
      categoryId: f.expense.id,
      amountMinor: "100",
      currency: "BRL",
      occurredOn: "2026-08-04",
      description: "Expense",
    })
    expect(result.ok && result.value.warnings).toBeUndefined()
  })
})
