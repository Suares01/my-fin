/* @vitest-environment jsdom */

import type { CategorySummary } from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CategoriesPage } from "./categories-page"
import { filterCategories } from "./category-list-model"

const state = vi.hoisted(() => ({
  createIncome: vi.fn(),
  createExpense: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
}))

const hooks = vi.hoisted(() => ({
  useCategories: vi.fn(),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({
    session: { status: "ACTIVE", bookId: "book-1" },
  }),
}))

vi.mock("../hooks", () => ({
  useCategories: hooks.useCategories,
  useCreateIncomeCategory: () => ({
    mutateAsync: state.createIncome,
    isPending: false,
  }),
  useCreateExpenseCategory: () => ({
    mutateAsync: state.createExpense,
    isPending: false,
  }),
  useUpdateCategory: () => ({
    mutateAsync: state.updateCategory,
    isPending: false,
  }),
  useArchiveCategory: () => ({
    mutateAsync: state.archiveCategory,
    isPending: false,
  }),
}))

const categories: readonly CategorySummary[] = [
  {
    id: "income-1",
    name: "Salário",
    kind: "INCOME",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "expense-1",
    name: "Mercado",
    kind: "EXPENSE",
    status: "ACTIVE",
    version: 1,
  },
  {
    id: "archived-1",
    name: "Legada",
    kind: "EXPENSE",
    status: "ARCHIVED",
    version: 1,
  },
]

describe("CategoriesPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    hooks.useCategories.mockReset()
    state.createIncome.mockReset()
    state.createExpense.mockReset()
    state.updateCategory.mockReset()
    state.archiveCategory.mockReset()
  })

  it("filters active categories by type and excludes archived categories", () => {
    expect(filterCategories(categories, "ACTIVE", "INCOME")).toEqual([
      categories[0],
    ])
    expect(filterCategories(categories, "ACTIVE", "EXPENSE")).toEqual([
      categories[1],
    ])
    expect(filterCategories(categories, "ACTIVE", "ALL")).toEqual(
      categories.slice(0, 2)
    )
  })

  it("queries only active categories", () => {
    hooks.useCategories.mockReturnValue({
      isPending: false,
      isError: false,
      data: categories,
    })

    render(<CategoriesPage />)

    expect(hooks.useCategories).toHaveBeenCalledWith(false)
    expect(screen.getByText("Salário")).toBeTruthy()
    expect(screen.queryByText("Legada")).toBeNull()
  })

  it("keeps the creation CTA available for an empty filter and closes its drawer", async () => {
    state.createIncome.mockResolvedValue({ value: { id: "income-2" } })
    hooks.useCategories.mockReturnValue({
      isPending: false,
      isError: false,
      data: [categories[1]],
    })

    render(<CategoriesPage />)

    fireEvent.click(screen.getByRole("button", { name: "Receitas" }))
    expect(
      screen.getByText("Nenhuma categoria de receita foi encontrada.")
    ).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    )
    expect(screen.getByRole("dialog").textContent).toContain(
      "Adicionar categoria"
    )
    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "Freelance" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Receita" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    )
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    )
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
