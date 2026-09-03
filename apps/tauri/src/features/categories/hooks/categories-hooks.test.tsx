/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { useActiveBook } from "../../../providers/use-active-book.js"

import {
  categoryKeys,
  useCreateExpenseCategory,
  useCreateIncomeCategory,
  useExpenseCategories,
} from "./index.js"
import { MyFinServices } from "../../../bootstrap/create-services.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"

const category = { id: "category-1", name: "Mercado", kind: "EXPENSE" } as const

function services(): MyFinServices {
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {
      listExpenses: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      },
      createExpense: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: category }),
      },
      createIncome: {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { ...category, kind: "INCOME" },
        }),
      },
    } as never,
    income: {} as never,
    expenses: {} as never,
    transfers: {} as never,
    journal: {} as never,
    insights: {} as never,
  }
}

function wrapperFor(
  serviceFacade: MyFinServices,
  queryClient: QueryClient,
  initialBookId: string | null = "book-1"
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={queryClient}>
        <MyFinProvider services={serviceFacade}>
          <ActiveBookProvider
            initial={
              initialBookId
                ? { status: "ACTIVE", bookId: initialBookId }
                : { status: "UNRESOLVED" }
            }
          >
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}

describe("expense category hooks", () => {
  it("keeps category queries book-scoped", () => {
    expect(categoryKeys.expenseCategories("book-1")).toEqual([
      "books",
      "book-1",
      "expense-categories",
    ])
    expect(categoryKeys.expenseCategories("book-1")).not.toEqual(
      categoryKeys.expenseCategories("book-2")
    )
  })

  it("returns the empty backend response without inventing categories", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useExpenseCategories(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.data).toEqual([]))
    expect(serviceFacade.categories.listExpenses.execute).toHaveBeenCalledWith({
      bookId: "book-1",
    })
  })

  it("returns expense summaries from the port", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.listExpenses.execute).mockResolvedValue({
      ok: true,
      value: [category],
    })
    const { result } = renderHook(() => useExpenseCategories(), {
      wrapper: wrapperFor(
        serviceFacade,
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      ),
    })
    await waitFor(() => expect(result.current.data).toEqual([category]))
    expect(result.current.data?.[0]).toEqual(category)
  })

  it("surfaces a Result failure without replacing it with fake data", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.listExpenses.execute).mockResolvedValue({
      ok: false,
      error: new Error("category query failed"),
    } as never)
    const { result } = renderHook(() => useExpenseCategories(), {
      wrapper: wrapperFor(
        serviceFacade,
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      ),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("does not query categories without an active book", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useExpenseCategories(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.categories.listExpenses.execute).not.toHaveBeenCalled()
  })

  it("switches query scope when the active book changes", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.listExpenses.execute)
      .mockResolvedValueOnce({ ok: true, value: [category] })
      .mockResolvedValueOnce({ ok: true, value: [] })
    const { result } = renderHook(
      () => ({ query: useExpenseCategories(), active: useActiveBook() }),
      { wrapper: wrapperFor(serviceFacade, new QueryClient()) }
    )
    await waitFor(() => expect(result.current.query.data).toEqual([category]))
    act(() => result.current.active.actions.activate("book-2"))
    await waitFor(() => expect(result.current.query.data).toEqual([]))
    expect(
      serviceFacade.categories.listExpenses.execute
    ).toHaveBeenLastCalledWith({ bookId: "book-2" })
  })

  it("creates only an EXPENSE command and never retries automatically", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useCreateExpenseCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    const command = { bookId: "book-1", name: "Mercado", kind: "EXPENSE" }
    await act(async () => {
      await result.current.mutateAsync(command)
    })
    expect(serviceFacade.categories.createExpense.execute).toHaveBeenCalledWith(
      command
    )
    expect(result.current.failureCount).toBe(0)
  })

  it("invalidates the expense selector and category lists for the successful book", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useCreateExpenseCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({
        bookId: "book-1",
        name: "Mercado",
        kind: "EXPENSE",
      })
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: categoryKeys.expenseCategories("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: categoryKeys.all("book-1"),
    })
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it("invalidates the income selector and category lists after an income category is created", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useCreateIncomeCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({
        bookId: "book-1",
        name: "Salário",
        kind: "INCOME",
      })
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: categoryKeys.incomeCategories("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: categoryKeys.all("book-1"),
    })
  })

  it("does not invalidate when category creation fails", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.createExpense.execute).mockResolvedValue(
      { ok: false, error: new Error("duplicate") } as never
    )
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useCreateExpenseCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await expect(
      act(async () => {
        await result.current.mutateAsync({
          bookId: "book-1",
          name: "Mercado",
          kind: "EXPENSE",
        })
      })
    ).rejects.toThrow("duplicate")
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("preserves the last successful category data when a later fetch fails", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.listExpenses.execute)
      .mockResolvedValueOnce({ ok: true, value: [category] })
      .mockResolvedValueOnce({
        ok: false,
        error: new Error("refresh failed"),
      } as never)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useExpenseCategories(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.data).toEqual([category]))
    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toEqual([category])
    expect(serviceFacade.categories.listExpenses.execute).toHaveBeenCalledTimes(
      2
    )
  })
})
