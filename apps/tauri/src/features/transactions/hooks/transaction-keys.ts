import type { TransactionServerFilters } from "../transaction-list-model.js"

export const transactionKeys = {
  all: (bookId: string) => ["books", bookId, "transactions"] as const,
  lists: (bookId: string) => [...transactionKeys.all(bookId), "list"] as const,
  list: (bookId: string, filters: TransactionServerFilters) =>
    [...transactionKeys.lists(bookId), filters] as const,
  details: (bookId: string) =>
    [...transactionKeys.all(bookId), "detail"] as const,
  detail: (bookId: string, chainId: string) =>
    [...transactionKeys.details(bookId), chainId] as const,
}
