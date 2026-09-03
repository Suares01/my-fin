import type { QueryClient } from "@tanstack/react-query"
import { accountKeys } from "./accounts/hooks"
import { categoryKeys } from "./categories/hooks"
import { transactionKeys } from "./transactions/hooks/transaction-keys"

export interface ProjectionRefreshOutcome {
  readonly ok: boolean
  readonly failedScopes: readonly (
    | "transactions"
    | "balances"
    | "statements"
    | "insights"
  )[]
}

type ProjectionRefreshScope = ProjectionRefreshOutcome["failedScopes"][number]

export async function refreshTransactionProjections(
  queryClient: QueryClient,
  input: {
    readonly bookId: string
    readonly chainId?: string
    readonly accountIds: readonly string[]
  }
): Promise<ProjectionRefreshOutcome> {
  const accountIds = [...new Set(input.accountIds)]
  const refreshes: ReadonlyArray<
    readonly [ProjectionRefreshScope, Promise<unknown>]
  > = [
    [
      "transactions",
      queryClient.invalidateQueries({
        queryKey: transactionKeys.lists(input.bookId),
        exact: false,
      }),
    ],
    ...(input.chainId === undefined
      ? []
      : [
          [
            "transactions" as const,
            queryClient.invalidateQueries({
              queryKey: transactionKeys.detail(input.bookId, input.chainId),
              exact: true,
            }),
          ] as const,
        ]),
    [
      "balances",
      queryClient.invalidateQueries({
        queryKey: accountKeys.balances(input.bookId),
        exact: true,
      }),
    ],
    ...accountIds.map(
      (accountId) =>
        [
          "statements" as const,
          queryClient.invalidateQueries({
            queryKey: accountKeys.statement(input.bookId, accountId),
            exact: true,
          }),
        ] as const
    ),
    [
      "insights",
      queryClient.invalidateQueries({
        queryKey: ["books", input.bookId, "insights"],
        exact: false,
      }),
    ],
  ]
  const settled = await Promise.allSettled(
    refreshes.map(([, refresh]) => refresh)
  )
  const failedScopes = [
    ...new Set(
      settled.flatMap((result, index) => {
        const scope = refreshes[index]?.[0]
        return result.status === "rejected" && scope !== undefined
          ? [scope]
          : []
      })
    ),
  ]

  return { ok: failedScopes.length === 0, failedScopes }
}

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
