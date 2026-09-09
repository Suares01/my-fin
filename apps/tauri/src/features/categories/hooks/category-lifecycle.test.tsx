/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { categoryKeys } from "./category-keys.js"
import {
  useArchiveCategory,
  useReactivateCategory,
  useUpdateCategory,
} from "./use-category-lifecycle.js"

const category = {
  id: "category-1",
  bookId: "book-1",
  name: "Mercado",
  kind: "EXPENSE",
  status: "ACTIVE",
  iconKey: "label-dollar",
  colorHex: "f43f5e",
  version: 4,
} as const

const updateCommand = {
  bookId: "book-1",
  categoryId: "category-1",
  expectedVersion: 4,
  name: "Supermercado",
  iconKey: "cart",
  colorHex: "abcdef",
} as const

const transitionCommand = {
  bookId: "book-1",
  categoryId: "category-1",
  expectedVersion: 4,
} as const

function services(): MyFinServices {
  const handler = () => ({
    execute: vi.fn().mockResolvedValue({ ok: true, value: category }),
  })
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {
      update: handler(),
      archive: handler(),
      reactivate: handler(),
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
  bookId = "book-1"
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={queryClient}>
        <MyFinProvider services={serviceFacade}>
          <ActiveBookProvider initial={{ status: "ACTIVE", bookId }}>
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}

describe("category lifecycle hooks", () => {
  it("updates a category with appearance and version once", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })

    await expect(result.current.mutateAsync(updateCommand)).resolves.toMatchObject(
      {
        value: category,
        refresh: { ok: true, failedScopes: [] },
        refreshWarning: false,
      }
    )
    expect(serviceFacade.categories.update.execute).toHaveBeenCalledOnce()
    expect(serviceFacade.categories.update.execute).toHaveBeenCalledWith(
      updateCommand
    )
  })

  it("archives using categoryId and the current expected version once", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })

    await result.current.mutateAsync(transitionCommand)

    expect(serviceFacade.categories.archive.execute).toHaveBeenCalledOnce()
    expect(serviceFacade.categories.archive.execute).toHaveBeenCalledWith(
      transitionCommand
    )
  })

  it("reactivates using categoryId and the current expected version once", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useReactivateCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })

    await result.current.mutateAsync(transitionCommand)

    expect(serviceFacade.categories.reactivate.execute).toHaveBeenCalledOnce()
    expect(serviceFacade.categories.reactivate.execute).toHaveBeenCalledWith(
      transitionCommand
    )
  })

  it("invalidates the category detail when update reports a version conflict", async () => {
    const serviceFacade = services()
    const conflict = Object.assign(new Error("stale"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    vi.mocked(serviceFacade.categories.update.execute).mockResolvedValue({
      ok: false,
      error: conflict,
    } as never)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })

    await expect(result.current.mutateAsync(updateCommand)).rejects.toBe(conflict)

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: categoryKeys.detail("book-1", "category-1"),
      exact: true,
    })
  })

  it("does not replay a conflicted update implicitly", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.update.execute).mockRejectedValue(
      new Error("storage")
    )
    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })

    await expect(result.current.mutateAsync(updateCommand)).rejects.toThrow(
      "storage"
    )
    expect(serviceFacade.categories.update.execute).toHaveBeenCalledOnce()
  })

  it("keeps a successful archive distinct from a partial refresh warning", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValueOnce(
      new Error("refresh failed")
    )
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })

    await expect(result.current.mutateAsync(transitionCommand)).resolves.toMatchObject(
      {
        value: category,
        refresh: { ok: false, failedScopes: ["management"] },
        refreshWarning: true,
      }
    )
  })

  it("uses the command book when the active book differs", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useReactivateCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient, "book-1"),
    })

    await result.current.mutateAsync({ ...transitionCommand, bookId: "book-2" })

    const queryKeys = invalidate.mock.calls.map(([input]) => input.queryKey)
    expect(queryKeys).not.toContainEqual(expect.arrayContaining(["book-1"]))
    expect(queryKeys).toContainEqual(expect.arrayContaining(["book-2"]))
  })

  it("does not refresh when the category service rejects", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.archive.execute).mockResolvedValue({
      ok: false,
      error: new Error("archive failed"),
    } as never)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })

    await expect(result.current.mutateAsync(transitionCommand)).rejects.toThrow(
      "archive failed"
    )
    expect(invalidate).not.toHaveBeenCalled()
  })
})
