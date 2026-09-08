/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type { JournalChainListItem } from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import type { TransactionFilters } from "../transaction-list-model.js"
import { useTransactionChains } from "./use-transaction-chains.js"

const filters: TransactionFilters = {
  from: "",
  to: "",
  search: "",
  types: ["INCOME", "EXPENSE", "TRANSFER"],
  accountIds: [],
  categoryIds: [],
  status: "ALL",
}

function item(
  overrides: Partial<JournalChainListItem> = {}
): JournalChainListItem {
  return {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    type: "INCOME",
    status: "ACTIVE",
    occurredOn: "2026-09-03",
    recordedAt: "2026-09-03T12:00:00.000Z",
    sequence: "1",
    description: "Receita",
    origin: "MANUAL",
    amountMinor: "100",
    currency: "BRL",
    financialAccounts: [],
    categories: [],
    ...overrides,
  }
}

function services(): MyFinServices {
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {} as never,
    income: {} as never,
    expenses: {} as never,
    transfers: {} as never,
    journal: {
      listChains: {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { items: [item()], nextCursor: null },
        }),
      },
    } as never,
    insights: {} as never,
  }
}

function wrapperFor(
  serviceFacade: MyFinServices,
  queryClient: QueryClient,
  initial: "book-1" | "book-2" | null = "book-1"
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={queryClient}>
        <MyFinProvider services={serviceFacade}>
          <ActiveBookProvider
            initial={
              initial === null
                ? { status: "UNRESOLVED" }
                : { status: "ACTIVE", bookId: initial }
            }
          >
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}

describe("useTransactionChains", () => {
  it("does not query without an active book", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.journal.listChains.execute).not.toHaveBeenCalled()
  })

  it("queries the active book with fixed transaction types and page size", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(serviceFacade.journal.listChains.execute).toHaveBeenCalledWith({
      bookId: "book-1",
      types: ["EXPENSE", "INCOME", "TRANSFER"],
      limit: 20,
    })
  })

  it("never sends OPENING_BALANCE in the fixed transaction query boundary", async () => {
    const serviceFacade = services()
    const { result } = renderHook(
      () => useTransactionChains({ ...filters, types: ["INCOME", "TRANSFER"] }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(serviceFacade.journal.listChains.execute).toHaveBeenCalledWith(
      expect.objectContaining({ types: ["INCOME", "TRANSFER"] })
    )
  })

  it("passes only the opaque cursor returned by the previous page", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.listChains.execute)
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [item()], nextCursor: "opaque-next" },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [item({ chainId: "chain-2" })], nextCursor: null },
      })
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    expect(serviceFacade.journal.listChains.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "opaque-next" })
    )
  })

  it("deduplicates overlapping chain pages in server order", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.listChains.execute)
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [item()], nextCursor: "next" },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          items: [item(), item({ chainId: "chain-2" })],
          nextCursor: null,
        },
      })
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() =>
      expect(result.current.data?.items.map((chain) => chain.chainId)).toEqual([
        "chain-1",
        "chain-2",
      ])
    )
  })

  it("restarts at the first page when normalized server filters change", async () => {
    const serviceFacade = services()
    const { result, rerender } = renderHook(
      ({ currentFilters }) => useTransactionChains(currentFilters),
      {
        initialProps: { currentFilters: filters },
        wrapper: wrapperFor(serviceFacade, new QueryClient()),
      }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ currentFilters: { ...filters, search: "  Mercado " } })
    await waitFor(() =>
      expect(serviceFacade.journal.listChains.execute).toHaveBeenCalledTimes(2)
    )
    expect(serviceFacade.journal.listChains.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "mercado" })
    )
  })

  it("exposes an initial service failure as query error", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.listChains.execute).mockResolvedValue({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    } as never)
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("disables automatic query retries", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.listChains.execute).mockResolvedValue({
      ok: false,
      error: { code: "ENTITY_NOT_FOUND" },
    } as never)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 3 } },
    })
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, client),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(serviceFacade.journal.listChains.execute).toHaveBeenCalledTimes(1)
  })

  it("recovers an invalid pagination cursor once by requesting page one", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.listChains.execute)
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [item()], nextCursor: "bad-cursor" },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "INVALID_QUERY" },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        value: { items: [item()], nextCursor: null },
      })
    const { result } = renderHook(() => useTransactionChains(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    expect(serviceFacade.journal.listChains.execute).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ cursor: expect.anything() })
    )
  })

  it("uses a new book-scoped query when the active book changes", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result } = renderHook(
      () => ({
        chains: useTransactionChains(filters),
        activeBook: useActiveBook(),
      }),
      { wrapper: wrapperFor(serviceFacade, queryClient) }
    )
    await waitFor(() => expect(result.current.chains.isSuccess).toBe(true))
    act(() => result.current.activeBook.actions.activate("book-2"))
    await waitFor(() =>
      expect(serviceFacade.journal.listChains.execute).toHaveBeenCalledTimes(2)
    )
    expect(serviceFacade.journal.listChains.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ bookId: "book-2" })
    )
  })
})
