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

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "UNRESOLVED" },
  query: {
    isPending: false,
    isError: false,
    data: [] as readonly CategorySummary[],
    refetch: vi.fn(),
  },
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useCategories: vi.fn(() => state.query),
}))

vi.mock("./category-card", () => ({
  CategoryCard: ({
    category,
    onEdit,
  }: {
    readonly category: CategorySummary
    readonly onEdit?: (category: CategorySummary) => void
  }) => (
    <article>
      <h2>{category.name}</h2>
      <button type="button" onClick={() => onEdit?.(category)}>
        Editar {category.name}
      </button>
    </article>
  ),
}))

vi.mock("./category-form", () => ({
  CategoryForm: ({
    mode = "create",
    initialCategory,
    onSuccess,
    onCancel,
  }: {
    readonly mode?: "create" | "edit"
    readonly initialCategory?: CategorySummary
    readonly onSuccess?: (categoryId: string) => void
    readonly onCancel?: () => void
  }) => (
    <div data-testid="category-form">
      <span>{mode === "edit" ? initialCategory?.name : "novo formulário"}</span>
      <button type="button" onClick={() => onSuccess?.("category-created")}>
        {mode === "edit" ? "Salvar categoria" : "Criar categoria"}
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  ),
}))

import { CategoriesPage } from "./categories-page"

const categories: readonly CategorySummary[] = [
  {
    id: "income-1",
    name: "Salário",
    kind: "INCOME",
    status: "ACTIVE",
    iconKey: "wallet",
    colorHex: "10b981",
    version: 1,
  },
  {
    id: "expense-1",
    name: "Mercado",
    kind: "EXPENSE",
    status: "ACTIVE",
    iconKey: "cart",
    colorHex: "f43f5e",
    version: 2,
  },
  {
    id: "archived-1",
    name: "Legada",
    kind: "EXPENSE",
    status: "ARCHIVED",
    iconKey: "archive",
    colorHex: "64748b",
    version: 3,
  },
]

function renderPage(
  query: Partial<typeof state.query> = {},
  session = state.session
) {
  state.query = { ...state.query, ...query }
  state.session = session
  return render(<CategoriesPage />)
}

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
    state.query = {
      isPending: false,
      isError: false,
      data: categories,
      refetch: vi.fn(),
    }
    state.session = { status: "ACTIVE", bookId: "book-1" }
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("queries archived categories and starts with Active and All", () => {
    renderPage()

    expect(
      screen
        .getByRole("button", { name: "Ativas" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen.getByRole("button", { name: "Todas" }).getAttribute("aria-pressed")
    ).toBe("true")
    expect(screen.getByText("Salário")).toBeTruthy()
    expect(screen.queryByText("Legada")).toBeNull()
  })

  it("filters archived categories by status and type independently", () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Arquivadas" }))
    fireEvent.click(screen.getByRole("button", { name: "Despesas" }))

    expect(screen.getByText("Legada")).toBeTruthy()
    expect(screen.queryByText("Mercado")).toBeNull()
    expect(screen.queryByText("Salário")).toBeNull()
  })

  it("keeps one selected option in each filter group", () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Receitas" }))
    fireEvent.click(screen.getByRole("button", { name: "Arquivadas" }))

    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true")
    ).toHaveLength(2)
  })

  it("shows a semantic loading state", () => {
    renderPage({ isPending: true, data: undefined })

    expect(screen.getByLabelText("Carregando categorias")).toBeTruthy()
    expect(screen.queryByText("Nenhuma categoria")).toBeNull()
  })

  it("shows a retryable query error", () => {
    const refetch = vi.fn()
    renderPage({ isError: true, refetch })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar carregar categorias novamente",
      })
    )

    expect(refetch).toHaveBeenCalledOnce()
    expect(screen.getByRole("alert")).toBeTruthy()
  })

  it("preserves the creation CTA for an empty active filter", () => {
    renderPage({ data: [] })

    expect(screen.getByText(/Nenhuma categoria ativa/)).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    ).toBeTruthy()
  })

  it("preserves the creation CTA for an empty archived filter", () => {
    renderPage({ data: categories })
    fireEvent.click(screen.getByRole("button", { name: "Arquivadas" }))
    fireEvent.click(screen.getByRole("button", { name: "Receitas" }))

    expect(screen.getByText(/Nenhuma categoria de receita/)).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    ).toBeTruthy()
  })

  it("opens the create sheet with a title and returns focus after cancel", async () => {
    renderPage()
    const trigger = screen.getByRole("button", { name: /Adicionar categoria/i })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole("dialog").textContent).toContain(
      "Adicionar categoria"
    )
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it("closes the create sheet after a successful form", async () => {
    renderPage()
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    )
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("opens edit with current category values and closes on success", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Editar Mercado" }))

    expect(screen.getByRole("dialog").textContent).toContain("Mercado")
    expect(screen.getByRole("dialog").textContent).toContain("Editar categoria")
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("closes edit on cancel without losing the list", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Editar Mercado" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByText("Mercado")).toBeTruthy()
  })

  it("closes an open sheet and clears edit state when the book changes", async () => {
    const rendered = renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Editar Mercado" }))
    expect(screen.getByRole("dialog")).toBeTruthy()

    state.session = { status: "ACTIVE", bookId: "book-2" }
    rendered.rerender(<CategoriesPage />)

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar categoria/i })
    )
    expect(screen.getByRole("dialog").textContent).not.toContain("Mercado")
  })
})
