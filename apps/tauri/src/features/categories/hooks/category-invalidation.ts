import type { QueryClient } from "@tanstack/react-query"
import { categoryKeys } from "./category-keys.js"

export interface CategoryInvalidationOutcome {
  readonly ok: boolean
  readonly failedScopes: readonly CategoryInvalidationScope[]
}

type CategoryInvalidationScope = "management" | "income" | "expense"

export async function invalidateCategoryQueries(
  queryClient: QueryClient,
  input: { readonly bookId: string }
): Promise<CategoryInvalidationOutcome> {
  const refreshes: ReadonlyArray<
    readonly [CategoryInvalidationScope, Promise<unknown>]
  > = [
    [
      "management",
      queryClient.invalidateQueries({
        queryKey: categoryKeys.all(input.bookId),
        exact: false,
      }),
    ],
    [
      "income",
      queryClient.invalidateQueries({
        queryKey: categoryKeys.incomeCategories(input.bookId),
        exact: true,
      }),
    ],
    [
      "expense",
      queryClient.invalidateQueries({
        queryKey: categoryKeys.expenseCategories(input.bookId),
        exact: true,
      }),
    ],
  ]

  const settled = await Promise.allSettled(
    refreshes.map(([, refresh]) => refresh)
  )
  const failedScopes = settled.flatMap((result, index) =>
    result.status === "rejected" && refreshes[index] !== undefined
      ? [refreshes[index][0]]
      : []
  )

  return { ok: failedScopes.length === 0, failedScopes }
}
