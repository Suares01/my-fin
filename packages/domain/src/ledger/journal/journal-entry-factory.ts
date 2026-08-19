import { FinancialBook } from "../../book/financial-book.js"
import {
  isFinancialAccount,
  LedgerAccount,
} from "../accounts/ledger-account.js"
import type { JournalEntryId, PostingId } from "../../shared/identity/ids.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { LocalDate } from "../../shared/local-date.js"
import { Money } from "../../shared/money.js"
import { JournalEntry } from "./journal-entry.js"
import { Posting } from "./posting.js"

interface JournalFactoryInput {
  readonly id: JournalEntryId
  readonly book: FinancialBook
  readonly occurredOn: LocalDate
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly amount: Money
  readonly replacementOf?: JournalEntryId
}

export interface SetOpeningBalanceInput extends JournalFactoryInput {
  readonly account: LedgerAccount
  readonly openingBalanceAccount: LedgerAccount
  readonly accountPostingId: PostingId
  readonly openingBalancePostingId: PostingId
}

export interface RecordExpenseInput extends JournalFactoryInput {
  readonly financialAccount: LedgerAccount
  readonly expenseCategory: LedgerAccount
  readonly financialPostingId: PostingId
  readonly categoryPostingId: PostingId
}

export interface RecordIncomeInput extends JournalFactoryInput {
  readonly financialAccount: LedgerAccount
  readonly incomeCategory: LedgerAccount
  readonly financialPostingId: PostingId
  readonly categoryPostingId: PostingId
}

export interface TransferInput extends JournalFactoryInput {
  readonly originAccount: LedgerAccount
  readonly destinationAccount: LedgerAccount
  readonly originPostingId: PostingId
  readonly destinationPostingId: PostingId
}

export const setOpeningBalance = (
  input: SetOpeningBalanceInput
): JournalEntry => {
  assertCommonInput(input)
  assertSameBook(input.book, input.account, input.openingBalanceAccount)
  assertActive(input.account, input.openingBalanceAccount)
  if (input.account.kind !== "ASSET" && input.account.kind !== "LIABILITY") {
    throw invalidKind("Opening balance requires an ASSET or LIABILITY account")
  }
  if (input.openingBalanceAccount.systemPurpose !== "OPENING_BALANCE") {
    throw invalidKind("Opening balance requires its system account")
  }

  const accountAmount =
    input.account.kind === "ASSET" ? input.amount : input.amount.negate()
  return JournalEntry.post({
    id: input.id,
    bookId: input.book.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    sequence: input.sequence,
    description: input.description,
    currency: input.book.baseCurrency,
    origin: "MANUAL",
    replacementOf: input.replacementOf,
    postings: [
      Posting.create({
        id: input.accountPostingId,
        accountId: input.account.id,
        amount: accountAmount,
      }),
      Posting.create({
        id: input.openingBalancePostingId,
        accountId: input.openingBalanceAccount.id,
        amount: accountAmount.negate(),
      }),
    ],
  })
}

export const recordExpense = (input: RecordExpenseInput): JournalEntry => {
  assertCommonInput(input)
  assertSameBook(input.book, input.financialAccount, input.expenseCategory)
  assertActive(input.financialAccount, input.expenseCategory)
  assertFinancialAccount(input.financialAccount)
  if (input.expenseCategory.kind !== "EXPENSE") {
    throw invalidKind("Expense recording requires an EXPENSE category")
  }

  return JournalEntry.post({
    id: input.id,
    bookId: input.book.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    sequence: input.sequence,
    description: input.description,
    currency: input.book.baseCurrency,
    origin: "MANUAL",
    replacementOf: input.replacementOf,
    postings: [
      Posting.create({
        id: input.categoryPostingId,
        accountId: input.expenseCategory.id,
        amount: input.amount,
      }),
      Posting.create({
        id: input.financialPostingId,
        accountId: input.financialAccount.id,
        amount: input.amount.negate(),
      }),
    ],
  })
}

export const recordIncome = (input: RecordIncomeInput): JournalEntry => {
  assertCommonInput(input)
  assertSameBook(input.book, input.financialAccount, input.incomeCategory)
  assertActive(input.financialAccount, input.incomeCategory)
  assertFinancialAccount(input.financialAccount)
  if (input.incomeCategory.kind !== "INCOME") {
    throw invalidKind("Income recording requires an INCOME category")
  }

  return JournalEntry.post({
    id: input.id,
    bookId: input.book.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    sequence: input.sequence,
    description: input.description,
    currency: input.book.baseCurrency,
    origin: "MANUAL",
    replacementOf: input.replacementOf,
    postings: [
      Posting.create({
        id: input.financialPostingId,
        accountId: input.financialAccount.id,
        amount: input.amount,
      }),
      Posting.create({
        id: input.categoryPostingId,
        accountId: input.incomeCategory.id,
        amount: input.amount.negate(),
      }),
    ],
  })
}

export const transfer = (input: TransferInput): JournalEntry => {
  assertCommonInput(input)
  assertSameBook(input.book, input.originAccount, input.destinationAccount)
  assertActive(input.originAccount, input.destinationAccount)
  assertFinancialAccount(input.originAccount)
  assertFinancialAccount(input.destinationAccount)
  if (input.originAccount.id === input.destinationAccount.id) {
    throw new DomainError(
      "SAME_TRANSFER_ACCOUNT",
      "Transfer origin and destination must differ"
    )
  }

  return JournalEntry.post({
    id: input.id,
    bookId: input.book.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    sequence: input.sequence,
    description: input.description,
    currency: input.book.baseCurrency,
    origin: "MANUAL",
    replacementOf: input.replacementOf,
    postings: [
      Posting.create({
        id: input.originPostingId,
        accountId: input.originAccount.id,
        amount: input.amount.negate(),
      }),
      Posting.create({
        id: input.destinationPostingId,
        accountId: input.destinationAccount.id,
        amount: input.amount,
      }),
    ],
  })
}

export const JournalEntryFactory = {
  setOpeningBalance,
  recordExpense,
  recordIncome,
  transfer,
}

function assertCommonInput(input: JournalFactoryInput): void {
  if (input.amount.amountMinor <= 0n) {
    throw new DomainError(
      "NON_POSITIVE_AMOUNT",
      "Journal factory amount must be positive"
    )
  }

  if (!input.amount.currency.equals(input.book.baseCurrency)) {
    throw new DomainError(
      "CURRENCY_MISMATCH",
      "Journal amount must use the book base currency"
    )
  }
}

function assertSameBook(
  book: FinancialBook,
  ...accounts: readonly LedgerAccount[]
): void {
  if (accounts.some((account) => account.bookId !== book.id)) {
    throw new DomainError(
      "BOOK_MISMATCH",
      "Journal accounts must belong to the book"
    )
  }
}

function assertActive(...accounts: readonly LedgerAccount[]): void {
  if (accounts.some((account) => account.status !== "ACTIVE")) {
    throw new DomainError(
      "INVALID_ACCOUNT_STATUS",
      "Journal accounts must be active"
    )
  }
}

function assertFinancialAccount(account: LedgerAccount): void {
  if (!isFinancialAccount(account)) {
    throw invalidKind("Journal operation requires a financial account")
  }
}

function invalidKind(message: string): DomainError {
  return new DomainError("INVALID_ACCOUNT_KIND", message)
}
