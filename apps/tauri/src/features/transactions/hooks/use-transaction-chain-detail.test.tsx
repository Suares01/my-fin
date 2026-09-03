/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type { JournalChainDetail } from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider, useActiveBook } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { useTransactionChainDetail } from "./use-transaction-chain-detail.js"

const detail: JournalChainDetail = {
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
  postings: [],
  history: [],
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
      getChain: { execute: vi.fn().mockResolvedValue({ ok: true, value: detail }) },
    } as never,
    insights: {} as never,
  }
}

function wrapperFor(serviceFacade: MyFinServices, queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={queryClient}>
        <MyFinProvider services={serviceFacade}>
          <ActiveBookProvider initial={{ status: "ACTIVE", bookId: "book-1" }}>
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}

describe("useTransactionChainDetail", () => {
  it("stays idle until detail is explicitly requested", () => {
    const serviceFacade = services()
    const { result } = renderHook(
      () => useTransactionChainDetail({ chainId: "chain-1", presentedEntryId: "entry-1", enabled: false }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.journal.getChain.execute).not.toHaveBeenCalled()
  })

  it("loads detail with the active book and presented entry identity", async () => {
    const serviceFacade = services()
    const { result } = renderHook(
      () => useTransactionChainDetail({ chainId: "chain-1", presentedEntryId: "entry-1", enabled: true }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.data).toEqual(detail))
    expect(serviceFacade.journal.getChain.execute).toHaveBeenCalledWith({ bookId: "book-1", entryId: "entry-1" })
  })

  it("uses the latest presented entry while retaining the stable chain cache identity", async () => {
    const serviceFacade = services()
    const { result, rerender } = renderHook(
      ({ presentedEntryId }) =>
        useTransactionChainDetail({ chainId: "chain-1", presentedEntryId, enabled: true }),
      { initialProps: { presentedEntryId: "entry-1" }, wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ presentedEntryId: "entry-2" })
    await waitFor(() => expect(serviceFacade.journal.getChain.execute).toHaveBeenCalledTimes(2))
    expect(serviceFacade.journal.getChain.execute).toHaveBeenLastCalledWith({ bookId: "book-1", entryId: "entry-2" })
  })

  it("turns an absent detail into an explicit error state", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.getChain.execute).mockResolvedValue({ ok: true, value: null } as never)
    const { result } = renderHook(
      () => useTransactionChainDetail({ chainId: "chain-1", presentedEntryId: "entry-1", enabled: true }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe("Transaction chain detail was not found")
  })

  it("turns a service failure into an explicit error state", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.getChain.execute).mockResolvedValue({ ok: false, error: new Error("safe") } as never)
    const { result } = renderHook(
      () => useTransactionChainDetail({ chainId: "chain-1", presentedEntryId: "entry-1", enabled: true }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("refetches fresh detail after a previous failure", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.getChain.execute)
      .mockResolvedValueOnce({ ok: false, error: new Error("safe") } as never)
      .mockResolvedValueOnce({ ok: true, value: detail })
    const { result } = renderHook(
      () => useTransactionChainDetail({ chainId: "chain-1", presentedEntryId: "entry-1", enabled: true }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.data).toEqual(detail))
  })

  it("uses a new detail request after an active-book switch", async () => {
    const serviceFacade = services()
    const { result } = renderHook(
      () => ({ detail: useTransactionChainDetail({ chainId: "chain-1", presentedEntryId: "entry-1", enabled: true }), activeBook: useActiveBook() }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true))
    act(() => result.current.activeBook.actions.activate("book-2"))
    await waitFor(() => expect(serviceFacade.journal.getChain.execute).toHaveBeenCalledTimes(2))
    expect(serviceFacade.journal.getChain.execute).toHaveBeenLastCalledWith({ bookId: "book-2", entryId: "entry-1" })
  })
})
