/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { useBookDetail } from "../../books/hooks/index.js"
import { bookKeys } from "../../books/hooks/book-keys.js"
import {
  categoryKeys,
  useCategories,
  useCategoryDetail,
  useExpenseCategories,
  useIncomeCategories,
} from "./index.js"
import { MyFinServices } from "../../../bootstrap/create-services.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"

const book = {
  id: "book-1",
  name: "Casa",
  baseCurrency: "BRL",
  timezone: "America/Sao_Paulo",
} as const
const expense = { id: "expense-1", name: "Mercado", kind: "EXPENSE" as const }
const income = { id: "income-1", name: "Salário", kind: "INCOME" as const }
const managed = { ...expense, status: "ARCHIVED" as const, version: 2 }

function services(): MyFinServices {
  return {
    books: {
      get: { execute: vi.fn().mockResolvedValue({ ok: true, value: book }) },
    } as never,
    accounts: {} as never,
    categories: {
      list: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: [managed] }),
      },
      listIncome: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: [income] }),
      },
      listExpenses: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: [expense] }),
      },
      get: { execute: vi.fn().mockResolvedValue({ ok: true, value: managed }) },
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

describe("category and book directory hooks", () => {
  it("keeps selector and management keys distinct", () => {
    expect(categoryKeys.expenseCategories("book-1")).not.toEqual(
      categoryKeys.list("book-1", true)
    )
    expect(categoryKeys.incomeCategories("book-1")).not.toEqual(
      categoryKeys.list("book-1", true)
    )
    expect(categoryKeys.detail("book-1", "category-1")).not.toEqual(
      categoryKeys.list("book-1", true)
    )
  })

  it("loads active income categories for the active book", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useIncomeCategories(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual([income]))
    expect(serviceFacade.categories.listIncome.execute).toHaveBeenCalledWith({
      bookId: "book-1",
    })
  })

  it("loads active expense selectors without changing the existing contract", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useExpenseCategories(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual([expense]))
    expect(serviceFacade.categories.listExpenses.execute).toHaveBeenCalledWith({
      bookId: "book-1",
    })
  })

  it("loads archived data through the management list", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useCategories(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual([managed]))
    expect(serviceFacade.categories.list.execute).toHaveBeenCalledWith({
      bookId: "book-1",
      includeArchived: true,
    })
    expect(result.current.data?.[0]?.status).toBe("ARCHIVED")
  })

  it("can request an active-only management list with a separate cache", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useCategories(false), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual([managed]))
    expect(serviceFacade.categories.list.execute).toHaveBeenCalledWith({
      bookId: "book-1",
      includeArchived: false,
    })
    expect(categoryKeys.list("book-1", false)).not.toEqual(
      categoryKeys.list("book-1", true)
    )
  })

  it("resolves an archived category through its book-scoped deep-link key", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useCategoryDetail("expense-1"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual(managed))
    expect(serviceFacade.categories.get.execute).toHaveBeenCalledWith({
      bookId: "book-1",
      categoryId: "expense-1",
    })
    expect(result.current.data?.status).toBe("ARCHIVED")
  })

  it("does not query category detail without both scopes", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useCategoryDetail(undefined), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.categories.get.execute).not.toHaveBeenCalled()
  })

  it("surfaces a safe category detail failure without archived fabrication", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.get.execute).mockResolvedValue({
      ok: false,
      error: new Error("private query"),
    } as never)
    const { result } = renderHook(() => useCategoryDetail("expense-1"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("loads a book summary through its independent detail key", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useBookDetail(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual(book))
    expect(bookKeys.detail("book-1")).toEqual(["books", "book-1", "detail"])
    expect(serviceFacade.books.get.execute).toHaveBeenCalledWith({
      bookId: "book-1",
    })
  })

  it("supports a deep-linked book id without changing the active session key", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useBookDetail("book-2"), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.data).toEqual(book))
    expect(serviceFacade.books.get.execute).toHaveBeenCalledWith({
      bookId: "book-2",
    })
    expect(bookKeys.detail("book-2")).not.toEqual(bookKeys.detail("book-1"))
  })

  it("keeps directory queries disabled without an active book", () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useCategories(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient(), null),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.categories.list.execute).not.toHaveBeenCalled()
  })

  it("does not retry book detail failures and does not expose the driver error", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.books.get.execute).mockResolvedValue({
      ok: false,
      error: new Error("/private/vault"),
    } as never)
    const { result } = renderHook(() => useBookDetail(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(result.current.failureCount).toBe(1)
  })

  it("keeps category list failures separate from selector data", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.list.execute).mockResolvedValue({
      ok: false,
      error: new Error("list failed"),
    } as never)
    const { result } = renderHook(() => useCategories(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(serviceFacade.categories.listIncome.execute).not.toHaveBeenCalled()
  })
})
