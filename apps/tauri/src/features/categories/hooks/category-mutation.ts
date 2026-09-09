import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CategoryDto } from "@workspace/application"
import {
  invalidateCategoryQueries,
  type CategoryInvalidationOutcome,
} from "./category-invalidation.js"

type ApplicationResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: Error }

export type CategoryMutationResult = {
  readonly value: CategoryDto
  readonly refresh: CategoryInvalidationOutcome
  readonly refreshWarning: boolean
}

export function useCategoryMutation<
  TCommand extends { readonly bookId: string },
>(input: {
  readonly execute: (
    command: TCommand
  ) => Promise<ApplicationResult<CategoryDto>>
}) {
  const queryClient = useQueryClient()

  return useMutation<CategoryMutationResult, Error, TCommand>({
    mutationFn: async (command) => {
      const result = await input.execute(command)
      if (!result.ok) throw result.error

      const refresh = await invalidateCategoryQueries(queryClient, {
        bookId: command.bookId,
      })
      return {
        value: result.value,
        refresh,
        refreshWarning: !refresh.ok,
      }
    },
    retry: false,
  })
}
