import type { QueryClient } from "@tanstack/react-query"
import { accountKeys } from "./accounts/hooks"
import { categoryKeys } from "./categories/hooks"

export function invalidateLedgerQueries(
  queryClient: QueryClient,
  input: {
    readonly bookId: string
    readonly accountIds: readonly string[]
  }
): Promise<readonly unknown[]> {
  const accountIds = [...new Set(input.accountIds)]
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: accountKeys.balances(input.bookId),
      exact: true,
    }),
    ...accountIds.map((accountId) =>
      queryClient.invalidateQueries({
        queryKey: accountKeys.statement(input.bookId, accountId),
        exact: true,
      })
    ),
  ])
}

export function invalidateJournalMutationQueries(
  queryClient: QueryClient,
  input: {
    readonly bookId: string
    readonly journalEntryId: string
  }
): Promise<readonly unknown[]> {
  return Promise.all([
    invalidateLedgerQueries(queryClient, {
      bookId: input.bookId,
      accountIds: [],
    }),
    queryClient.invalidateQueries({
      queryKey: ["books", input.bookId, "accounts"],
      exact: false,
    }),
  ])
}

export function invalidateLifecycleQueries(
  queryClient: QueryClient,
  input: {
    readonly bookId: string
    readonly accountId: string
    readonly scope: "account" | "category"
  }
): Promise<readonly unknown[]> {
  return Promise.all([
    invalidateLedgerQueries(queryClient, {
      bookId: input.bookId,
      accountIds: input.scope === "account" ? [input.accountId] : [],
    }),
    input.scope === "account"
      ? queryClient.invalidateQueries({
          queryKey: accountKeys.detail(input.bookId, input.accountId),
          exact: true,
        })
      : queryClient.invalidateQueries({
          queryKey: categoryKeys.all(input.bookId),
          exact: false,
        }),
  ])
}
