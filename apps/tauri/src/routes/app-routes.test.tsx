/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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
vi.mock("../features/investments/components/investments-page", () => ({
  InvestmentsPage: ({
    positionId,
    onNavigatePosition,
  }: {
    positionId?: string
    onNavigatePosition: (id: string | null) => void
  }) => (
    <section data-testid="investment-content">
      <h1>Investimentos</h1>
      <p data-testid="position-route">{positionId ?? "lista"}</p>
      <button onClick={() => onNavigatePosition("position-1")}>
        Ver posição
      </button>
      <button onClick={() => onNavigatePosition(null)}>Fechar posição</button>
    </section>
  ),
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

function renderRoutes(path: string, bookId: string | null = "book-1") {
  mocks.activeBook.mockReturnValue({
    session: bookId ? { status: "ACTIVE", bookId } : { status: "UNRESOLVED" },
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

  it("renders investments on direct navigation inside the shell", () => {
    renderRoutes("/investments")
    expect(screen.getByRole("heading", { name: "Investimentos" })).toBeTruthy()
    expect(screen.getByTestId("application-shell").textContent).toContain(
      "Investimentos"
    )
    expect(screen.getByTestId("position-route").textContent).toBe("lista")
  })

  it("passes a direct position URL to the investments page", () => {
    renderRoutes("/investments/positions/position-2")
    expect(screen.getByTestId("position-route").textContent).toBe("position-2")
  })

  it("navigates from the list to a position URL", () => {
    renderRoutes("/investments")
    fireEvent.click(screen.getByRole("button", { name: "Ver posição" }))
    expect(screen.getByTestId("position-route").textContent).toBe("position-1")
  })

  it("preserves the investments page instance while opening a position", () => {
    renderRoutes("/investments")
    const page = screen.getByTestId("investment-content")
    fireEvent.click(screen.getByRole("button", { name: "Ver posição" }))
    expect(screen.getByTestId("investment-content")).toBe(page)
  })

  it("returns from a position URL to the investments list", () => {
    renderRoutes("/investments/positions/position-2")
    fireEvent.click(screen.getByRole("button", { name: "Fechar posição" }))
    expect(screen.getByTestId("position-route").textContent).toBe("lista")
  })

  it("requires book selection before opening investments", () => {
    renderRoutes("/investments", null)
    expect(
      screen.getByText("Selecione um livro para ver investimentos")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Escolher livro" }).getAttribute("href")
    ).toBe("/books")
    expect(screen.queryByRole("heading", { name: "Investimentos" })).toBeNull()
  })

  it("keeps the dashboard route available beside investments", () => {
    renderRoutes("/dashboard")
    expect(screen.getByRole("heading", { name: "Categorias" })).toBeTruthy()
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
