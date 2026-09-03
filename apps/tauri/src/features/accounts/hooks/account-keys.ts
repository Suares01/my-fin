export const accountKeys = {
  balances: (bookId: string, includeArchived = false) =>
    includeArchived
      ? (["books", bookId, "account-balances", "with-archived"] as const)
      : (["books", bookId, "account-balances"] as const),
  detail: (bookId: string, accountId: string) =>
    ["books", bookId, "accounts", accountId, "detail"] as const,
  statement: (bookId: string, accountId: string) =>
    ["books", bookId, "accounts", accountId, "statement"] as const,
}
