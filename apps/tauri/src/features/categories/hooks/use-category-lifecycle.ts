import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  ArchiveCategoryCommand,
  CategoryDto,
  ReactivateCategoryCommand,
  UpdateCategoryCommand,
} from "@workspace/application"
import { useMyFin } from "../../../providers"
import {
  invalidateCategoryQueries,
  type CategoryInvalidationOutcome,
} from "./category-invalidation.js"
import { categoryKeys } from "./category-keys.js"
import type { CategoryMutationResult } from "./category-mutation.js"

type ApplicationResult =
  | { readonly ok: true; readonly value: CategoryDto }
  | { readonly ok: false; readonly error: Error }

type CategoryLifecycleCommand = {
  readonly bookId: string
  readonly categoryId: string
}

function useCategoryLifecycleMutation<TCommand extends CategoryLifecycleCommand>(
  execute: (command: TCommand) => Promise<ApplicationResult>
) {
  const queryClient = useQueryClient()

  return useMutation<CategoryMutationResult, Error, TCommand>({
    mutationFn: async (command) => {
      const result = await execute(command)
      if (!result.ok) {
        if (isConcurrencyConflict(result.error)) {
          await queryClient
            .invalidateQueries({
              queryKey: categoryKeys.detail(
                command.bookId,
                command.categoryId
              ),
              exact: true,
            })
            .catch(() => undefined)
        }
        throw result.error
      }

      const refresh = await invalidateCategoryQueries(queryClient, {
        bookId: command.bookId,
      })
      return toMutationResult(result.value, refresh)
    },
    retry: false,
  })
}

function toMutationResult(
  value: CategoryDto,
  refresh: CategoryInvalidationOutcome
): CategoryMutationResult {
  return { value, refresh, refreshWarning: !refresh.ok }
}

function isConcurrencyConflict(error: Error): boolean {
  return (
    "code" in error &&
    (error as Error & { readonly code?: unknown }).code ===
      "OPTIMISTIC_CONCURRENCY_FAILURE"
  )
}

export function useUpdateCategory() {
  const services = useMyFin()
  return useCategoryLifecycleMutation<UpdateCategoryCommand>((command) =>
    services.categories.update.execute(command)
  )
}

export function useArchiveCategory() {
  const services = useMyFin()
  return useCategoryLifecycleMutation<ArchiveCategoryCommand>((command) =>
    services.categories.archive.execute(command)
  )
}

export function useReactivateCategory() {
  const services = useMyFin()
  return useCategoryLifecycleMutation<ReactivateCategoryCommand>((command) =>
    services.categories.reactivate.execute(command)
  )
}
