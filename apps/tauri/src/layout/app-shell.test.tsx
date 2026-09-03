/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router"

const mocks = vi.hoisted(() => ({
  books: vi.fn(),
  activeBook: vi.fn(),
  navigation: vi.fn(),
}))

vi.mock("../features/books/hooks", () => ({
  useBooks: () => mocks.books(),
}))
vi.mock("../providers", () => ({
  useActiveBook: () => mocks.activeBook(),
}))
vi.mock("../features/books/hooks/use-book-page-navigation", () => ({
  BOOK_SWITCHER_NAVIGATION_STATE: { source: "book-switcher" },
}))
vi.mock("../features/books/hooks/use-book-route-navigation", () => ({
  useBookRouteNavigation: () => mocks.navigation(),
}))

import { ApplicationShell } from "./app-shell.js"

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  })
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("767") && width < 768,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

function renderShell(path: string) {
  mocks.books.mockReturnValue({
    data: [{ id: "book-1", name: "Casa", baseCurrency: "BRL", timezone: "UTC" }],
    isPending: false,
    isError: false,
  })
  mocks.activeBook.mockReturnValue({
    session: { status: "ACTIVE", bookId: "book-1" },
  })
  mocks.navigation.mockReturnValue({ activateAndOpenDashboard: vi.fn() })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ApplicationShell />}>
          <Route path="*" element={<h1>Conteúdo da rota</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function navigationLink(label: string) {
  const link = screen
    .getAllByRole("link", { name: label })
    .find((element) => element.getAttribute("data-sidebar") === "menu-button")
  if (!link) throw new Error(`Navigation link not found: ${label}`)
  return link
}

describe("ApplicationShell navigation", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    setViewport(1024)
  })

  it("renders the transactions link in desktop navigation", () => {
    setViewport(1024)
    renderShell("/transactions")
    expect(navigationLink("Transações")).toBeTruthy()
  })

  it("renders the transactions link in the opened mobile navigation", async () => {
    setViewport(375)
    renderShell("/transactions")
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy()
    )
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }))
    await waitFor(() =>
      expect(navigationLink("Transações")).toBeTruthy()
    )
  })

  it("marks transactions as active at its route", () => {
    setViewport(1024)
    renderShell("/transactions")
    expect(navigationLink("Transações").hasAttribute("data-active")).toBe(true)
  })

  it("shows the transactions breadcrumb", () => {
    setViewport(1024)
    renderShell("/transactions")
    expect(navigationLink("Transações")).toBeTruthy()
    expect(screen.getByLabelText("breadcrumb").textContent).toContain("Transações")
  })

  it("keeps the transactions destination keyboard-focusable and navigable", () => {
    setViewport(1024)
    renderShell("/dashboard")
    const transactions = navigationLink("Transações")
    transactions.focus()
    fireEvent.keyDown(transactions, { key: "Enter" })
    fireEvent.click(transactions)
    expect(document.activeElement).toBe(transactions)
    expect(transactions.getAttribute("href")).toBe("/transactions")
  })

  it("keeps the dashboard navigation available", () => {
    setViewport(1024)
    renderShell("/transactions")
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()
  })

  it("keeps the categories navigation available", () => {
    setViewport(1024)
    renderShell("/transactions")
    expect(screen.getByRole("link", { name: "Categorias" })).toBeTruthy()
  })
})
