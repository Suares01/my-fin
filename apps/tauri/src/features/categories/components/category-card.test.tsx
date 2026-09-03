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
  isPending: false,
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useArchiveCategory: () => ({
    mutateAsync: state.mutateAsync,
    isPending: state.isPending,
  }),
}))

import { CategoryCard } from "./category-card"

const category = {
  id: "category-1",
  name: "Mercado",
  kind: "EXPENSE" as const,
  status: "ACTIVE" as const,
  version: 3,
}

describe("CategoryCard", () => {
  afterEach(() => {
    cleanup()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.mutateAsync.mockReset()
    state.isPending = false
  })

  it("archives the category with its current version", async () => {
    state.mutateAsync.mockResolvedValue({ id: category.id })
    render(<CategoryCard category={category} />)

    fireEvent.click(screen.getByRole("button", { name: "Arquivar Mercado" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        accountId: "category-1",
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

    expect(
      await screen.findByText(
        "Não foi possível arquivar a categoria. Tente novamente."
      )
    ).toBeTruthy()
    expect(screen.queryByText(/vault\.sqlite/)).toBeNull()
  })
})
