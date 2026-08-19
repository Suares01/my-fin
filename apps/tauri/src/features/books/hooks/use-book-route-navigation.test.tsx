/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const navigate = vi.hoisted(() => vi.fn())

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
}))

import {
  ActiveBookProvider,
  createMyFinQueryClient,
  type ActiveBookSession,
} from "../../../providers/index.js"
import { useBookRouteNavigation } from "./use-book-route-navigation.js"

function wrapperFor(
  initial: ActiveBookSession,
  client: QueryClient = createMyFinQueryClient()
) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ActiveBookProvider initial={initial}>{children}</ActiveBookProvider>
      </QueryClientProvider>
    )
  }
}

afterEach(() => {
  navigate.mockReset()
})

describe("useBookRouteNavigation", () => {
  it("confirms creation before navigating a zero-book session", async () => {
    const { result } = renderHook(() => useBookRouteNavigation(), {
      wrapper: wrapperFor({ status: "REQUIRES_SELECTION", books: [] }),
    })

    act(() => result.current.requireCreationAndOpen())
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/books/new"))
  })

  it.each(["book-auto", "book-manual"])(
    "confirms ACTIVE(%s) before opening the dashboard",
    async (bookId) => {
      const { result } = renderHook(() => useBookRouteNavigation(), {
        wrapper: wrapperFor({ status: "REQUIRES_SELECTION", books: [] }),
      })

      act(() => result.current.activateAndOpenDashboard(bookId))
      await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"))
    }
  )

  it("leaves multiple books on selection until an explicit activation", () => {
    renderHook(() => useBookRouteNavigation(), {
      wrapper: wrapperFor({
        status: "REQUIRES_SELECTION",
        books: [
          { id: "book-1", name: "Casa", baseCurrency: "BRL", timezone: "UTC" },
          {
            id: "book-2",
            name: "Trabalho",
            baseCurrency: "USD",
            timezone: "UTC",
          },
        ],
      }),
    })

    expect(navigate).not.toHaveBeenCalled()
  })

  it("removes only the previous book queries before switching", async () => {
    const client = createMyFinQueryClient()
    client.setQueryData(["books", "book-1", "accounts"], ["old"])
    client.setQueryData(["books", "book-2", "accounts"], ["new"])
    client.setQueryData(["books"], ["catalog"])

    const { result } = renderHook(() => useBookRouteNavigation(), {
      wrapper: wrapperFor({ status: "ACTIVE", bookId: "book-1" }, client),
    })

    act(() => result.current.activateAndOpenDashboard("book-2"))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"))

    expect(client.getQueryData(["books", "book-1", "accounts"])).toBeUndefined()
    expect(client.getQueryData(["books", "book-2", "accounts"])).toEqual([
      "new",
    ])
    expect(client.getQueryData(["books"])).toEqual(["catalog"])
  })
})
