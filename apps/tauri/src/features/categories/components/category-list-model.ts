import type { CategorySummary } from "@workspace/application"

export type CategoryFilter = "ALL" | "INCOME" | "EXPENSE"

export const categoryFilters: ReadonlyArray<{
  readonly value: CategoryFilter
  readonly label: string
}> = [
  { value: "ALL", label: "Todas" },
  { value: "INCOME", label: "Receitas" },
  { value: "EXPENSE", label: "Despesas" },
]

export function filterCategories(
  categories: readonly CategorySummary[],
  filter: CategoryFilter
): readonly CategorySummary[] {
  return categories.filter(
    (category) =>
      category.status === "ACTIVE" &&
      (filter === "ALL" || category.kind === filter)
  )
}
