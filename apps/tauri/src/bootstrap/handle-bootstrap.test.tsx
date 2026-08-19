// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"

import type { MyFinServices } from "./create-services.js"
import { HandleBootstrap } from "./handle-bootstrap.js"
import { MyFinProviders } from "../providers/index.js"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("HandleBootstrap", () => {
  it.each([
    [[], "/books/new"],
    [[{ id: "book-1" }], "/dashboard"],
    [[{ id: "book-1" }, { id: "book-2" }], "/books"],
  ])("redirects %s books to %s", async (books, expectedPath) => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MyFinProviders services={servicesFor(books)}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <HandleBootstrap />
                  <LocationProbe />
                  <LocationStateProbe />
                </>
              }
            />
          </Routes>
        </MyFinProviders>
      </MemoryRouter>
    )

    expect(screen.getByRole("img", { name: "My Fin" })).toBeTruthy()
    await waitFor(() => expect(locationPath()).toBe(expectedPath))
    expect(locationState()).toBe("none")
  })
})

function servicesFor(books: readonly { id: string }[]): MyFinServices {
  return {
    books: {
      list: {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: books.map((book) => ({
            ...book,
            name: book.id,
            baseCurrency: "BRL",
            timezone: "UTC",
          })),
        }),
      },
    },
  } as unknown as MyFinServices
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function LocationStateProbe() {
  const location = useLocation()
  return (
    <output data-testid="location-state">
      {location.state === undefined ? "none" : "set"}
    </output>
  )
}

function locationState(): string {
  return screen.getByTestId("location-state").textContent ?? ""
}

function locationPath(): string {
  return screen.getByTestId("location").textContent ?? ""
}
