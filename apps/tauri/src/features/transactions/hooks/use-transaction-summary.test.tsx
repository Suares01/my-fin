/* @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { ApplicationError } from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import type { TransactionFilters } from "../transaction-list-model.js"
import { useTransactionSummary } from "./use-transaction-summary.js"

const filters: TransactionFilters = {
  from: "",
  to: "",
  search: "",
  types: ["INCOME", "EXPENSE", "TRANSFER"],
  accountIds: [],
  categoryIds: [],
  status: "ALL",
}

const summary = {
  incomeMinor: "2500",
  expenseMinor: "700",
  largestTransactionMinor: "2500",
  transactionCount: 3,
  currency: "BRL",
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
      summary: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: summary }),
      },
    } as never,
    insights: {} as never,
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

describe("useTransactionSummary", () => {
  it("does not query without an active book", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useTransactionSummary(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })

    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.journal.summary.execute).not.toHaveBeenCalled()
  })

  it("queries the active book with normalized filters and omits ALL status", async () => {
    const serviceFacade = services()
    const filtered: TransactionFilters = {
      ...filters,
      from: " 2026-08-01 ",
      to: " 2026-08-31 ",
      search: " Café ",
      accountIds: [" account-2 ", "account-1"],
      categoryIds: ["category-1"],
    }
    const { result } = renderHook(() => useTransactionSummary(filtered), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual(summary))
    expect(serviceFacade.journal.summary.execute).toHaveBeenCalledWith({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-31",
      search: "café",
      types: ["EXPENSE", "INCOME", "TRANSFER"],
      accountIds: ["account-1", "account-2"],
      categoryIds: ["category-1"],
    })
  })

  it("refetches under a distinct key when a selected status changes", async () => {
    const serviceFacade = services()
    const { result, rerender } = renderHook(
      ({ status }: { status: TransactionFilters["status"] }) =>
        useTransactionSummary({ ...filters, status }),
      {
        initialProps: {
          status: "ACTIVE" as TransactionFilters["status"],
        },
        wrapper: wrapperFor(serviceFacade, new QueryClient()),
      }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    rerender({ status: "CANCELLED" })

    await waitFor(() =>
      expect(serviceFacade.journal.summary.execute).toHaveBeenCalledTimes(2)
    )
    expect(serviceFacade.journal.summary.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "CANCELLED" })
    )
  })

  it("exposes a service failure without automatic retries", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.summary.execute).mockResolvedValue({
      ok: false,
      error: new ApplicationError("UNEXPECTED_ERROR", "summary failed"),
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 3 } },
    })
    const { result } = renderHook(() => useTransactionSummary(filters), {
      wrapper: wrapperFor(serviceFacade, client),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(serviceFacade.journal.summary.execute).toHaveBeenCalledTimes(1)
  })

  it("allows an explicit refetch after a failure", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.journal.summary.execute)
      .mockResolvedValueOnce({
        ok: false,
        error: new ApplicationError("UNEXPECTED_ERROR", "offline"),
      })
      .mockResolvedValueOnce({ ok: true, value: summary })
    const { result } = renderHook(() => useTransactionSummary(filters), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(result.current.data).toEqual(summary))
    expect(serviceFacade.journal.summary.execute).toHaveBeenCalledTimes(2)
  })
})
