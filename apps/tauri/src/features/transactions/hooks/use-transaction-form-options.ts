import { useBookDetail } from "../../books/hooks/use-book-detail.js"
import { useAccountBalances } from "../../accounts/hooks/use-account-balances.js"
import { useIncomeCategories } from "../../categories/hooks/use-income-categories.js"
import { useExpenseCategories } from "../../categories/hooks/use-expense-categories.js"
import { useActiveBook } from "../../../providers/use-active-book.js"

export type TransactionFormType = "INCOME" | "EXPENSE" | "TRANSFER"

export type TransactionFormOption = {
  readonly id: string
  readonly name: string
}

export function useTransactionFormOptions(type: TransactionFormType) {
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const book = useBookDetail(bookId ?? undefined)
  const accounts = useAccountBalances(false)
  const incomeCategories = useIncomeCategories()
  const expenseCategories = useExpenseCategories()
  const categories = type === "INCOME" ? incomeCategories : expenseCategories
  const baseCurrency = book.data?.baseCurrency
  const financialAccounts: readonly TransactionFormOption[] =
    accounts.data
      ?.filter(
        (account) =>
          !account.archived &&
          (baseCurrency === undefined || account.currency === baseCurrency)
      )
      .map((account) => ({
        id: account.accountId,
        name: account.accountName,
      })) ?? []
  const categoryOptions: readonly TransactionFormOption[] =
    type === "TRANSFER"
      ? []
      : (categories.data ?? []).map((category) => ({
          id: category.id,
          name: category.name,
        }))

  const loading =
    bookId !== null &&
    (book.isLoading ||
      accounts.isLoading ||
      (type !== "TRANSFER" && categories.isLoading))
  const error =
    book.error ??
    accounts.error ??
    (type === "TRANSFER" ? null : categories.error)

  return {
    bookId,
    baseCurrency,
    accounts: financialAccounts,
    categories: categoryOptions,
    loading,
    error,
    requiresTwoAccounts: type === "TRANSFER" && financialAccounts.length < 2,
    missingAccounts: !loading && financialAccounts.length === 0,
    missingCategories:
      type !== "TRANSFER" && !loading && categoryOptions.length === 0,
    refresh: async () => {
      await Promise.all([
        book.refetch(),
        accounts.refetch(),
        ...(type === "TRANSFER" ? [] : [categories.refetch()]),
      ])
    },
  }
}
