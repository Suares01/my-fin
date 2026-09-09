import type { CategorySummary } from "@workspace/application"

export type CategoryFilter = "ALL" | "INCOME" | "EXPENSE"

export type CategoryStatusFilter = "ACTIVE" | "ARCHIVED"
export type CategoryTypeFilter = CategoryFilter

export const categoryStatusFilters: ReadonlyArray<{
  readonly value: CategoryStatusFilter
  readonly label: string
}> = [
  { value: "ACTIVE", label: "Ativas" },
  { value: "ARCHIVED", label: "Arquivadas" },
]

export const categoryTypeFilters: ReadonlyArray<{
  readonly value: CategoryFilter
  readonly label: string
}> = [
  { value: "ALL", label: "Todas" },
  { value: "INCOME", label: "Receitas" },
  { value: "EXPENSE", label: "Despesas" },
]

export const categoryFilters = categoryTypeFilters

export function filterCategories(
  categories: readonly CategorySummary[],
  statusFilter: CategoryStatusFilter = "ACTIVE",
  typeFilter: CategoryTypeFilter = "ALL"
): readonly CategorySummary[] {
  return categories.filter(
    (category) =>
      category.status === statusFilter &&
      (typeFilter === "ALL" || category.kind === typeFilter)
  )
}
