import { describe, expect, it } from "vitest"
import { FinancialBook } from "../../book/financial-book.js"
import { Currency } from "../../shared/identity/currency.js"
import {
  bookIdFromString,
  journalEntryIdFromString,
  ledgerAccountIdFromString,
  postingIdFromString,
} from "../../shared/identity/ids.js"
import { LocalDate } from "../../shared/local-date.js"
import { Money } from "../../shared/money.js"
import {
  JournalEntryFactory,
  recordExpense,
  recordIncome,
  setOpeningBalance,
  transfer,
} from "./journal-entry-factory.js"
import { LedgerAccount } from "../accounts/ledger-account.js"

const usd = Currency.parse("USD")
const book = FinancialBook.create({
  id: bookIdFromString("book-1"),
  name: "Book",
  baseCurrency: usd,
  timezone: "UTC",
})
const date = LocalDate.parse("2026-08-04")

function account(
  id: string,
  kind: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY",
  systemPurpose?: "OPENING_BALANCE"
) {
  return LedgerAccount.create({
    id: ledgerAccountIdFromString(id),
    bookId: book.id,
    name: id,
    kind,
    ...(systemPurpose === undefined ? {} : { systemPurpose }),
  })
}

function baseInput(amount = Money.of(1250n, usd)) {
  return {
    id: journalEntryIdFromString("entry-1"),
    book,
    occurredOn: date,
    recordedAt: "2026-08-04T12:00:00.000Z",
    sequence: "1",
    description: " Groceries ",
    amount,
  }
}

function openingInput(accountToOpen: LedgerAccount) {
  return {
    ...baseInput(),
    account: accountToOpen,
    openingBalanceAccount: account("opening", "EQUITY", "OPENING_BALANCE"),
    accountPostingId: postingIdFromString("posting-account"),
    openingBalancePostingId: postingIdFromString("posting-opening"),
  }
}

function expenseInput(category = account("food", "EXPENSE")) {
  return {
    ...baseInput(),
    financialAccount: account("cash", "ASSET"),
    expenseCategory: category,
    financialPostingId: postingIdFromString("posting-cash"),
    categoryPostingId: postingIdFromString("posting-food"),
  }
}

function incomeInput(category = account("salary", "INCOME")) {
  return {
    ...baseInput(),
    financialAccount: account("cash", "ASSET"),
    incomeCategory: category,
    financialPostingId: postingIdFromString("posting-cash"),
    categoryPostingId: postingIdFromString("posting-salary"),
  }
}

function transferInput() {
  return {
    ...baseInput(),
    originAccount: account("cash", "ASSET"),
    destinationAccount: account("bank", "ASSET"),
    originPostingId: postingIdFromString("posting-cash"),
    destinationPostingId: postingIdFromString("posting-bank"),
  }
}

describe("JournalEntryFactory", () => {
  it("creates the asset opening balance with debit and credit", () => {
    const entry = setOpeningBalance(openingInput(account("asset", "ASSET")))

    expect(entry.postings.map((posting) => posting.toSnapshot())).toEqual([
      {
        id: "posting-account",
        accountId: "asset",
        amountMinor: 1250n,
        currency: "USD",
      },
      {
        id: "posting-opening",
        accountId: "opening",
        amountMinor: -1250n,
        currency: "USD",
      },
    ])
  })

  it.each([
    [
      "opening",
      () =>
        setOpeningBalance({
          ...openingInput(account("asset", "ASSET")),
          replacementOf: journalEntryIdFromString("entry-original"),
        }),
    ],
    [
      "expense",
      () =>
        recordExpense({
          ...expenseInput(),
          replacementOf: journalEntryIdFromString("entry-original"),
        }),
    ],
    [
      "income",
      () =>
        recordIncome({
          ...incomeInput(),
          replacementOf: journalEntryIdFromString("entry-original"),
        }),
    ],
    [
      "transfer",
      () =>
        transfer({
          ...transferInput(),
          replacementOf: journalEntryIdFromString("entry-original"),
        }),
    ],
  ] as const)(
    "creates a version-zero %s replacement with its predecessor link",
    (_kind, create) => {
      const entry = create()

      expect(entry.version).toBe(0)
      expect(entry.replacementOf).toBe("entry-original")
      expect(entry.replacedBy).toBeUndefined()
    }
  )

  it("keeps ordinary factory entries without replacement lineage", () => {
    expect(recordExpense(expenseInput()).replacementOf).toBeUndefined()
  })

  it("rejects a factory replacement that references its own new ID", () => {
    expect(() =>
      recordIncome({
        ...incomeInput(),
        replacementOf: journalEntryIdFromString("entry-1"),
      })
    ).toThrowError(expect.objectContaining({ code: "INVALID_REVERSAL_ID" }))
  })

  it("creates the liability opening balance with opposite signs", () => {
    const entry = setOpeningBalance(
      openingInput(account("liability", "LIABILITY"))
    )

    expect(entry.postings.map((posting) => posting.amount.amountMinor)).toEqual(
      [-1250n, 1250n]
    )
  })

  it("creates an expense with debit in the category and credit in the account", () => {
    const entry = recordExpense(expenseInput())

    expect(entry.postings.map((posting) => posting.toSnapshot())).toEqual([
      {
        id: "posting-food",
        accountId: "food",
        amountMinor: 1250n,
        currency: "USD",
      },
      {
        id: "posting-cash",
        accountId: "cash",
        amountMinor: -1250n,
        currency: "USD",
      },
    ])
  })

  it("creates income with debit in the account and credit in the category", () => {
    const entry = recordIncome(incomeInput())

    expect(entry.postings.map((posting) => posting.toSnapshot())).toEqual([
      {
        id: "posting-cash",
        accountId: "cash",
        amountMinor: 1250n,
        currency: "USD",
      },
      {
        id: "posting-salary",
        accountId: "salary",
        amountMinor: -1250n,
        currency: "USD",
      },
    ])
  })

  it("creates a transfer with only origin and destination accounts", () => {
    const entry = transfer(transferInput())

    expect(entry.postings.map((posting) => posting.toSnapshot())).toEqual([
      {
        id: "posting-cash",
        accountId: "cash",
        amountMinor: -1250n,
        currency: "USD",
      },
      {
        id: "posting-bank",
        accountId: "bank",
        amountMinor: 1250n,
        currency: "USD",
      },
    ])
    expect(
      entry.postings.every((posting) =>
        ["cash", "bank"].includes(posting.accountId)
      )
    ).toBe(true)
  })

  it("exposes the same behavior through the factory object", () => {
    expect(JournalEntryFactory.transfer).toBe(transfer)
    expect(JournalEntryFactory.recordExpense).toBe(recordExpense)
    expect(JournalEntryFactory.recordIncome).toBe(recordIncome)
    expect(JournalEntryFactory.setOpeningBalance).toBe(setOpeningBalance)
  })

  it("rejects an opening balance for a non-financial account", () => {
    expect(() =>
      setOpeningBalance(openingInput(account("income", "INCOME")))
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACCOUNT_KIND" }))
  })

  it("rejects a category with the wrong role", () => {
    expect(() =>
      recordExpense(expenseInput(account("salary", "INCOME")))
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACCOUNT_KIND" }))
  })

  it.each([0n, -1n])("rejects a non-positive amount %s", (amountMinor) => {
    expect(() => recordIncome(incomeInput(undefined))).not.toThrow()
    expect(() =>
      recordIncome({ ...incomeInput(), amount: Money.of(amountMinor, usd) })
    ).toThrowError(expect.objectContaining({ code: "NON_POSITIVE_AMOUNT" }))
  })

  it("rejects an amount in a currency different from the book", () => {
    expect(() =>
      recordIncome({
        ...incomeInput(),
        amount: Money.of(1250n, Currency.parse("BRL")),
      })
    ).toThrowError(expect.objectContaining({ code: "CURRENCY_MISMATCH" }))
  })

  it("rejects accounts from another book", () => {
    const otherBook = FinancialBook.create({
      id: bookIdFromString("book-2"),
      name: "Other",
      baseCurrency: usd,
      timezone: "UTC",
    })
    const otherAccount = LedgerAccount.create({
      id: ledgerAccountIdFromString("other-cash"),
      bookId: otherBook.id,
      name: "Other cash",
      kind: "ASSET",
    })

    expect(() =>
      recordIncome({ ...incomeInput(), financialAccount: otherAccount })
    ).toThrowError(expect.objectContaining({ code: "BOOK_MISMATCH" }))
  })

  it("rejects inactive accounts", () => {
    const inactive = account("cash", "ASSET")
    inactive.archive()

    expect(() =>
      recordIncome({ ...incomeInput(), financialAccount: inactive })
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACCOUNT_STATUS" }))
  })

  it("rejects a transfer to the same account", () => {
    const same = account("cash", "ASSET")

    expect(() =>
      transfer({
        ...transferInput(),
        originAccount: same,
        destinationAccount: same,
      })
    ).toThrowError(expect.objectContaining({ code: "SAME_TRANSFER_ACCOUNT" }))
  })
})
