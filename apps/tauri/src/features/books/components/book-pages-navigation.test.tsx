// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"

const mockUseBooks = vi.hoisted(() => vi.fn())
const mockUseActiveBook = vi.hoisted(() => vi.fn())
const mockUseBookRouteNavigation = vi.hoisted(() => vi.fn())
const mockUseCreateBook = vi.hoisted(() => vi.fn())

vi.mock("../hooks/use-books.js", () => ({
  useBooks: mockUseBooks,
}))
vi.mock("../../../providers/use-active-book.js", () => ({
  useActiveBook: mockUseActiveBook,
}))
vi.mock("../hooks/use-book-route-navigation.js", () => ({
  useBookRouteNavigation: mockUseBookRouteNavigation,
}))
vi.mock("../hooks/use-book-route-navigation", () => ({
  useBookRouteNavigation: mockUseBookRouteNavigation,
}))
vi.mock("../hooks", () => ({
  bookErrorMessage: () =>
    "Não foi possível concluir a operação. Tente novamente.",
  useCreateBook: mockUseCreateBook,
}))

import { CreateBookPage } from "./create-book-page.js"
import { SelectBookPage } from "./select-books-page.js"
import { BOOK_SWITCHER_NAVIGATION_STATE } from "../hooks/use-book-page-navigation.js"

const books = [
  { id: "book-1", name: "Casa", baseCurrency: "BRL", timezone: "UTC" },
  {
    id: "book-2",
    name: "Trabalho",
    baseCurrency: "USD",
    timezone: "UTC",
  },
] as const

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("book page contextual back navigation", () => {
  it("shows the back action on the selection page only for switcher navigation", () => {
    mockUseBooks.mockReturnValue({
      data: books,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseActiveBook.mockReturnValue({
      session: { status: "REQUIRES_SELECTION", books },
    })
    mockUseBookRouteNavigation.mockReturnValue({
      activateAndOpenDashboard: vi.fn(),
    })

    renderBookPage("/books", <SelectBookPage />, BOOK_SWITCHER_NAVIGATION_STATE)
    expect(
      screen.getByRole("button", { name: "Voltar para a tela anterior" })
    ).toBeTruthy()

    cleanup()
    renderBookPage("/books", <SelectBookPage />)
    expect(
      screen.queryByRole("button", { name: "Voltar para a tela anterior" })
    ).toBeNull()
  })

  it("returns from the selection page to the previous history entry", async () => {
    mockUseBooks.mockReturnValue({
      data: books,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseActiveBook.mockReturnValue({
      session: { status: "REQUIRES_SELECTION", books },
    })
    mockUseBookRouteNavigation.mockReturnValue({
      activateAndOpenDashboard: vi.fn(),
    })

    renderWithHistory(
      <Routes>
        <Route path="/books" element={<SelectBookPage />} />
        <Route path="*" element={null} />
      </Routes>,
      "/books",
      BOOK_SWITCHER_NAVIGATION_STATE
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para a tela anterior" })
    )
    await waitFor(() => expect(locationPath()).toBe("/dashboard"))
  })

  it("preserves the switcher origin when moving from selection to creation", async () => {
    mockUseBooks.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseActiveBook.mockReturnValue({
      session: { status: "REQUIRES_SELECTION", books: [] },
    })
    mockUseBookRouteNavigation.mockReturnValue({
      activateAndOpenDashboard: vi.fn(),
    })

    renderWithHistory(
      <Routes>
        <Route path="/books" element={<SelectBookPage />} />
        <Route path="/books/new" element={<LocationStateProbe />} />
      </Routes>,
      "/books",
      BOOK_SWITCHER_NAVIGATION_STATE
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Criar primeiro livro" })
    )
    await waitFor(() =>
      expect(screen.getByTestId("location-state").textContent).toBe(
        "nav-book-switcher"
      )
    )
  })

  it("shows and uses the back action on the creation page", async () => {
    mockUseCreateBook.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    })
    mockUseBookRouteNavigation.mockReturnValue({
      activateAndOpenDashboard: vi.fn(),
    })

    renderWithHistory(
      <Routes>
        <Route path="/books/new" element={<CreateBookPage />} />
        <Route path="*" element={null} />
      </Routes>,
      "/books/new",
      BOOK_SWITCHER_NAVIGATION_STATE
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para a tela anterior" })
    )
    await waitFor(() => expect(locationPath()).toBe("/dashboard"))
  })

  it("does not show a back action on direct creation navigation", () => {
    mockUseCreateBook.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    })
    mockUseBookRouteNavigation.mockReturnValue({
      activateAndOpenDashboard: vi.fn(),
    })

    renderBookPage("/books/new", <CreateBookPage />)
    expect(
      screen.queryByRole("button", { name: "Voltar para a tela anterior" })
    ).toBeNull()
  })

  it("does not show a back action after a document reload", () => {
    mockUseCreateBook.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    })
    mockUseBookRouteNavigation.mockReturnValue({
      activateAndOpenDashboard: vi.fn(),
    })
    const getEntriesByType = vi
      .spyOn(performance, "getEntriesByType")
      .mockReturnValue([{ type: "reload" } as PerformanceNavigationTiming])

    renderBookPage(
      "/books/new",
      <CreateBookPage />,
      BOOK_SWITCHER_NAVIGATION_STATE
    )
    expect(
      screen.queryByRole("button", { name: "Voltar para a tela anterior" })
    ).toBeNull()

    getEntriesByType.mockRestore()
  })
})

function renderBookPage(
  path: string,
  page: React.ReactElement,
  state?: unknown
) {
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="*" element={page} />
      </Routes>
    </MemoryRouter>
  )
}

function renderWithHistory(
  routes: React.ReactElement,
  path: string,
  state: unknown
) {
  render(
    <MemoryRouter
      initialEntries={["/dashboard", { pathname: path, state }]}
      initialIndex={1}
    >
      {routes}
      <LocationProbe />
    </MemoryRouter>
  )
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function LocationStateProbe() {
  const location = useLocation()
  const state = location.state as { source?: string } | null
  return <output data-testid="location-state">{state?.source ?? "none"}</output>
}

function locationPath(): string {
  return screen.getByTestId("location").textContent ?? ""
}
