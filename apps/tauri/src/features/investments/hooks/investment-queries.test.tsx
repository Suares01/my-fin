/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import {
  investmentKeys,
  normalizeInvestmentPositionFilters,
  useInvestmentAccounts,
  useInvestmentInstruments,
  useInvestmentOperations,
  useInvestmentPortfolio,
  useInvestmentPosition,
  useInvestmentPositions,
  useInvestmentValuations,
} from "./index.js"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const book = {
  id: "book-1",
  name: "Casa",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
} as const

const page = { items: [], nextCursor: null } as const

function services(): MyFinServices {
  return {
    books: {
      get: { execute: vi.fn().mockResolvedValue({ ok: true, value: book }) },
    } as never,
    accounts: {} as never,
    categories: {} as never,
    income: {} as never,
    expenses: {} as never,
    transfers: {} as never,
    journal: {} as never,
    insights: {} as never,
    investments: {
      accounts: {
        list: { execute: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
      },
      instruments: {
        list: { execute: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
      },
      positions: {
        list: { execute: vi.fn().mockResolvedValue({ ok: true, value: page }) },
      },
      operations: {
        list: { execute: vi.fn().mockResolvedValue({ ok: true, value: page }) },
      },
      valuations: {
        list: { execute: vi.fn().mockResolvedValue({ ok: true, value: page }) },
      },
      portfolio: {
        summary: {
          execute: vi.fn().mockResolvedValue({
            ok: true,
            value: { bookId: "book-1", asOf: "2026-09-20", currency: "BRL" },
          }),
        },
      },
    } as never,
  }
}

function wrapperFor(
  serviceFacade: MyFinServices,
  queryClient: QueryClient,
  bookId: string | null = "book-1"
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={queryClient}>
        <MyFinProvider services={serviceFacade}>
          <ActiveBookProvider
            initial={
              bookId === null
                ? { status: "UNRESOLVED" }
                : { status: "ACTIVE", bookId }
            }
          >
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}

describe("investment query hooks", () => {
  it("keeps every investment query key scoped to its book and resource", () => {
    expect(investmentKeys.portfolio("book-1", "2026-09-20")).toEqual([
      "investments",
      "book-1",
      "portfolio",
      "2026-09-20",
    ])
    expect(investmentKeys.accounts("book-1", "2026-09-20")).not.toEqual(
      investmentKeys.accounts("book-2", "2026-09-20")
    )
    expect(investmentKeys.operations("book-1", "position-1")).not.toEqual(
      investmentKeys.valuations("book-1", "position-1")
    )
  })

  it("uses the normalized server filters as the positions cache identity", () => {
    expect(
      normalizeInvestmentPositionFilters({ search: "  CDB  ", status: "OPEN" })
    ).toEqual({
      search: "CDB",
      status: "OPEN",
    })
    expect(investmentKeys.positions("book-1", { search: "CDB" })).not.toEqual(
      investmentKeys.positions("book-1", { search: "Tesouro" })
    )
  })

  it("does not fetch investment data without an active book", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentInstruments(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(
      serviceFacade.investments.instruments.list.execute
    ).not.toHaveBeenCalled()
  })

  it("uses the book timezone date in the portfolio cache instead of a fixed 24-hour key", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useInvestmentPortfolio(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const referenceDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts()
      .reduce<Record<string, string>>(
        (parts, part) => ({ ...parts, [part.type]: part.value }),
        {}
      )
    expect(
      queryClient.getQueryData(
        investmentKeys.portfolio(
          "book-1",
          `${referenceDate.year}-${referenceDate.month}-${referenceDate.day}`
        )
      )
    ).toBeDefined()
    expect(
      serviceFacade.investments.portfolio.summary.execute
    ).toHaveBeenCalledWith({ bookId: "book-1" })
  })

  it("keeps a portfolio failure as an error without fabricating a zero balance", async () => {
    const serviceFacade = services()
    vi.mocked(
      serviceFacade.investments.portfolio.summary.execute
    ).mockResolvedValue({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    } as never)
    const { result } = renderHook(() => useInvestmentPortfolio(), {
      wrapper: wrapperFor(
        serviceFacade,
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      ),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("refetches the portfolio through the active book service on demand", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentPortfolio(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(async () => result.current.refetch())
    expect(
      serviceFacade.investments.portfolio.summary.execute
    ).toHaveBeenCalledTimes(2)
    expect(
      serviceFacade.investments.portfolio.summary.execute
    ).toHaveBeenLastCalledWith({ bookId: "book-1" })
  })

  it("loads investment accounts independently from portfolio totals", async () => {
    const serviceFacade = services()
    vi.mocked(
      serviceFacade.investments.accounts.list.execute
    ).mockResolvedValue({
      ok: true,
      value: [{ id: "account-1", cashMinor: "-100" }],
    } as never)
    const { result } = renderHook(() => useInvestmentAccounts(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() =>
      expect(result.current.data?.[0]?.cashMinor).toBe("-100")
    )
    expect(
      serviceFacade.investments.accounts.list.execute
    ).toHaveBeenCalledWith({ bookId: "book-1" })
  })

  it("loads active instruments without silently including archived entries", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentInstruments("ACTIVE"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      serviceFacade.investments.instruments.list.execute
    ).toHaveBeenCalledWith({
      bookId: "book-1",
      status: "ACTIVE",
    })
  })

  it("keeps active and archived instrument catalogues in separate caches", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result, rerender } = renderHook(
      ({ status }: { status: "ACTIVE" | "ARCHIVED" }) =>
        useInvestmentInstruments(status),
      {
        initialProps: { status: "ACTIVE" as "ACTIVE" | "ARCHIVED" },
        wrapper: wrapperFor(serviceFacade, queryClient),
      }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ status: "ARCHIVED" })
    await waitFor(() =>
      expect(
        serviceFacade.investments.instruments.list.execute
      ).toHaveBeenCalledTimes(2)
    )
    expect(
      queryClient.getQueryData(investmentKeys.instruments("book-1", "ACTIVE"))
    ).toBeDefined()
    expect(
      queryClient.getQueryData(investmentKeys.instruments("book-1", "ARCHIVED"))
    ).toBeDefined()
  })

  it("uses the required initial limit and selected filters for position pages", async () => {
    const serviceFacade = services()
    const { result } = renderHook(
      () =>
        useInvestmentPositions({
          accountId: "account-1",
          assetClass: "FIXED_INCOME",
          status: "OPEN",
          search: "CDB",
        }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      serviceFacade.investments.positions.list.execute
    ).toHaveBeenCalledWith({
      bookId: "book-1",
      accountId: "account-1",
      assetClass: "FIXED_INCOME",
      status: "OPEN",
      search: "CDB",
      limit: 25,
    })
  })

  it("passes the server cursor only to the next position page", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.investments.positions.list.execute)
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [{ id: "position-1" }], nextCursor: "cursor-2" },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [{ id: "position-2" }], nextCursor: null },
      } as never)
    const { result } = renderHook(() => useInvestmentPositions(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
    await act(async () => result.current.fetchNextPage())
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2))
    expect(result.current.data?.items.map((item) => item.id)).toEqual([
      "position-1",
      "position-2",
    ])
    expect(
      serviceFacade.investments.positions.list.execute
    ).toHaveBeenLastCalledWith({
      bookId: "book-1",
      limit: 25,
      cursor: "cursor-2",
    })
  })

  it("resets the positions cache when the deferred search changes", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result, rerender } = renderHook(
      ({ search }) => useInvestmentPositions({ search }),
      {
        initialProps: { search: "CDB" },
        wrapper: wrapperFor(serviceFacade, queryClient),
      }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ search: "Tesouro" })
    await waitFor(() =>
      expect(
        serviceFacade.investments.positions.list.execute
      ).toHaveBeenCalledTimes(2)
    )
    expect(
      queryClient.getQueryData(
        investmentKeys.positions("book-1", { search: "CDB" })
      )
    ).toBeDefined()
    expect(
      queryClient.getQueryData(
        investmentKeys.positions("book-1", { search: "Tesouro" })
      )
    ).toBeDefined()
  })

  it("loads one position by ID with both states scoped to the active book", async () => {
    const serviceFacade = services()
    vi.mocked(
      serviceFacade.investments.positions.list.execute
    ).mockResolvedValue({
      ok: true,
      value: {
        items: [{ id: "position-1", status: "CLOSED" }],
        nextCursor: null,
      },
    } as never)
    const { result } = renderHook(() => useInvestmentPosition("position-1"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data?.id).toBe("position-1"))
    expect(
      serviceFacade.investments.positions.list.execute
    ).toHaveBeenCalledWith({
      bookId: "book-1",
      positionId: "position-1",
      status: "ALL",
      limit: 1,
    })
  })

  it("returns null when a position is absent from the active book", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentPosition("foreign"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it("does not fetch position detail without an active book", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentPosition("position-1"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(
      serviceFacade.investments.positions.list.execute
    ).not.toHaveBeenCalled()
  })

  it("does not query position history until both the book and position are present", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentOperations(undefined), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(
      serviceFacade.investments.operations.list.execute
    ).not.toHaveBeenCalled()
  })

  it("loads operations with their own cursor and default page limit", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentOperations("position-1"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      serviceFacade.investments.operations.list.execute
    ).toHaveBeenCalledWith({
      bookId: "book-1",
      positionId: "position-1",
      limit: 25,
    })
  })

  it("loads valuations with a cursor cache independent from operations", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useInvestmentValuations("position-1"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      serviceFacade.investments.valuations.list.execute
    ).toHaveBeenCalledWith({
      bookId: "book-1",
      positionId: "position-1",
      limit: 25,
    })
    expect(investmentKeys.valuations("book-1", "position-1")).not.toEqual(
      investmentKeys.operations("book-1", "position-1")
    )
  })

  it("surfaces a history failure without returning a previous position value", async () => {
    const serviceFacade = services()
    vi.mocked(
      serviceFacade.investments.valuations.list.execute
    ).mockResolvedValue({
      ok: false,
      error: { code: "INVALID_QUERY" },
    } as never)
    const { result } = renderHook(() => useInvestmentValuations("position-1"), {
      wrapper: wrapperFor(
        serviceFacade,
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      ),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
