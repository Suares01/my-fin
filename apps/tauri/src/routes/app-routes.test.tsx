/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet } from "react-router"

const mocks = vi.hoisted(() => ({
  activeBook: vi.fn(),
}))

vi.mock("../providers/use-active-book.js", () => ({
  useActiveBook: () => mocks.activeBook(),
}))
vi.mock("../layout/app-shell", () => ({
  ApplicationShell: () => (
    <main data-testid="application-shell">
      <Outlet />
    </main>
  ),
}))
vi.mock("../features/transactions", async () => {
  const { useActiveBook } = await import("../providers/use-active-book.js")
  return {
    TransactionsPage: () => {
      const { session } = useActiveBook()
      return (
        <h1>
          Transações do livro{" "}
          {session.status === "ACTIVE" ? session.bookId : ""}
        </h1>
      )
    },
  }
})
vi.mock("../features/categories/components/categories-page", () => ({
  default: () => <h1>Categorias</h1>,
}))
vi.mock("../features/accounts/components/accounts-page", () => ({
  AccountsPage: () => <h1>Contas</h1>,
}))
vi.mock("../bootstrap/handle-bootstrap", () => ({
  HandleBootstrap: () => <h1>Bootstrap</h1>,
}))
vi.mock("../features/books/components/select-books-page", () => ({
  SelectBookPage: () => <h1>Livros</h1>,
}))
vi.mock("../features/books/components/create-book-page", () => ({
  CreateBookPage: () => <h1>Novo livro</h1>,
}))

import AppRoutes from "./app-routes.js"

function renderRoutes(path: string) {
  mocks.activeBook.mockReturnValue({
    session: { status: "ACTIVE", bookId: "book-1" },
  })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  )
}

describe("AppRoutes", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders transactions on direct navigation", () => {
    renderRoutes("/transactions")
    expect(
      screen.getByRole("heading", { name: "Transações do livro book-1" })
    ).toBeTruthy()
  })

  it("renders transactions inside the application shell", () => {
    renderRoutes("/transactions")
    expect(
      screen
        .getByTestId("application-shell")
        .contains(
          screen.getByRole("heading", { name: "Transações do livro book-1" })
        )
    ).toBe(true)
  })

  it("hands the active book context to transactions", () => {
    renderRoutes("/transactions")
    expect(screen.getByRole("heading").textContent).toContain("book-1")
  })

  it("keeps the accounts route available", () => {
    renderRoutes("/accounts")
    expect(screen.getByRole("heading", { name: "Contas" })).toBeTruthy()
  })

  it("keeps the categories route available", () => {
    renderRoutes("/categories")
    expect(screen.getByRole("heading", { name: "Categorias" })).toBeTruthy()
  })
})
