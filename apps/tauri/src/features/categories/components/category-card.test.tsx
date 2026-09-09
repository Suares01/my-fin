/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "UNRESOLVED" },
  mutateAsync: vi.fn(),
  reactivateAsync: vi.fn(),
  toastAdd: vi.fn(),
  isPending: false,
  reactivatePending: false,
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useArchiveCategory: () => ({
    mutateAsync: state.mutateAsync,
    isPending: state.isPending,
  }),
  useReactivateCategory: () => ({
    mutateAsync: state.reactivateAsync,
    isPending: state.reactivatePending,
  }),
}))

vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toastAdd },
}))

import { CategoryCard } from "./category-card"

const category = {
  id: "category-1",
  name: "Mercado",
  kind: "EXPENSE" as const,
  status: "ACTIVE" as const,
  iconKey: "cart",
  colorHex: "abcdef",
  version: 3,
}

describe("CategoryCard", () => {
  afterEach(() => {
    cleanup()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.mutateAsync.mockReset()
    state.reactivateAsync.mockReset()
    state.toastAdd.mockReset()
    state.isPending = false
    state.reactivatePending = false
  })

  it("archives the category with its current version", async () => {
    state.mutateAsync.mockResolvedValue({ id: category.id })
    render(<CategoryCard category={category} />)

    fireEvent.click(screen.getByRole("button", { name: "Arquivar Mercado" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        categoryId: "category-1",
        expectedVersion: 3,
      })
    )
  })

  it("disables archiving without an active book", () => {
    state.session = { status: "UNRESOLVED" }
    render(<CategoryCard category={category} />)

    expect(
      screen.getByRole("button", { name: "Arquivar Mercado" })
    ).toHaveProperty("disabled", true)
  })

  it("keeps internal errors private", async () => {
    state.mutateAsync.mockRejectedValue(new Error("/private/vault.sqlite"))
    render(<CategoryCard category={category} />)

    fireEvent.click(screen.getByRole("button", { name: "Arquivar Mercado" }))

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível arquivar a categoria",
      description: "Não foi possível arquivar a categoria. Tente novamente.",
    })
    expect(screen.getByText("Mercado")).toBeTruthy()
    expect(screen.queryByText(/vault\.sqlite/)).toBeNull()
  })

  it("renders the persisted icon and color without using color as text", () => {
    render(<CategoryCard category={category} />)

    const card = screen.getByText("Mercado").closest("article")
    expect(card).toBeTruthy()
    expect(
      (card?.querySelector("[data-category-accent]") as HTMLElement).style
        .backgroundColor
    ).toBe("rgb(171, 205, 239)")
    expect(
      (card?.querySelector("[data-category-icon]") as HTMLElement).style.color
    ).toBe("rgb(171, 205, 239)")
    expect(screen.getByText("Despesa")).toBeTruthy()
  })

  it("keeps lifecycle actions available when the icon key is unknown", () => {
    render(
      <CategoryCard
        category={{ ...category, iconKey: "removed-icon" }}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Editar Mercado")).toBeTruthy()
    expect(screen.getByLabelText("Arquivar Mercado")).toBeTruthy()
  })

  it("calls the edit action with the active category", () => {
    const onEdit = vi.fn()
    render(<CategoryCard category={category} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole("button", { name: "Editar Mercado" }))

    expect(onEdit).toHaveBeenCalledWith(category)
  })

  it("offers reactivate instead of archive for archived categories", async () => {
    state.reactivateAsync.mockResolvedValue({ id: category.id })
    const archived = { ...category, status: "ARCHIVED" as const }
    render(<CategoryCard category={archived} />)

    expect(
      screen.queryByRole("button", { name: "Arquivar Mercado" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Reativar Mercado" }))

    await waitFor(() =>
      expect(state.reactivateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        categoryId: "category-1",
        expectedVersion: 3,
      })
    )
  })

  it("disables both lifecycle actions while their mutation is pending", () => {
    state.isPending = true
    render(<CategoryCard category={category} />)

    expect(
      screen.getByRole("button", { name: "Editar Mercado" })
    ).toHaveProperty("disabled", true)
    expect(
      screen.getByRole("button", { name: "Arquivar Mercado" })
    ).toHaveProperty("disabled", true)
  })

  it("uses a safe toast when reactivation fails", async () => {
    state.reactivateAsync.mockRejectedValue({ code: "ENTITY_NOT_FOUND" })
    render(<CategoryCard category={{ ...category, status: "ARCHIVED" }} />)

    fireEvent.click(screen.getByRole("button", { name: "Reativar Mercado" }))

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível reativar a categoria",
      description: "Esta categoria não está mais disponível. Atualize a lista.",
    })
    expect(screen.getByText("Mercado")).toBeTruthy()
  })
})
