import type { CategorySummary } from "@workspace/application"
import { describe, expect, it } from "vitest"
import {
  categoryStatusFilters,
  categoryTypeFilters,
  filterCategories,
} from "./category-list-model"

const categories: readonly CategorySummary[] = [
  {
    id: "active-income",
    name: "Salário",
    kind: "INCOME",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "active-expense",
    name: "Mercado",
    kind: "EXPENSE",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "archived-income",
    name: "Bônus antigo",
    kind: "INCOME",
    status: "ARCHIVED",
    version: 2,
  },
  {
    id: "archived-expense",
    name: "Despesa antiga",
    kind: "EXPENSE",
    status: "ARCHIVED",
    version: 3,
  },
]

describe("category-list-model", () => {
  it("defaults to active categories of every type", () => {
    expect(filterCategories(categories)).toEqual([
      categories[0],
      categories[1],
    ])
  })

  it("filters archived categories independently from type", () => {
    expect(filterCategories(categories, "ARCHIVED", "ALL")).toEqual([
      categories[2],
      categories[3],
    ])
    expect(filterCategories(categories, "ARCHIVED", "INCOME")).toEqual([
      categories[2],
    ])
    expect(filterCategories(categories, "ARCHIVED", "EXPENSE")).toEqual([
      categories[3],
    ])
  })

  it("filters each active type without including archived entries", () => {
    expect(filterCategories(categories, "ACTIVE", "INCOME")).toEqual([
      categories[0],
    ])
    expect(filterCategories(categories, "ACTIVE", "EXPENSE")).toEqual([
      categories[1],
    ])
  })

  it("does not mutate the source collection", () => {
    const source = [...categories]

    filterCategories(source, "ARCHIVED", "INCOME")

    expect(source).toEqual(categories)
  })

  it("publishes labels for both exclusive filter groups", () => {
    expect(categoryStatusFilters).toEqual([
      { value: "ACTIVE", label: "Ativas" },
      { value: "ARCHIVED", label: "Arquivadas" },
    ])
    expect(categoryTypeFilters).toEqual([
      { value: "ALL", label: "Todas" },
      { value: "INCOME", label: "Receitas" },
      { value: "EXPENSE", label: "Despesas" },
    ])
  })

  it("returns an empty list when no combination matches", () => {
    expect(filterCategories([], "ACTIVE", "ALL")).toEqual([])
  })
})
