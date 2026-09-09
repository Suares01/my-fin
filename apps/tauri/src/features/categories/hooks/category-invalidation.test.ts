import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { categoryKeys } from "./category-keys.js"
import { invalidateCategoryQueries } from "./category-invalidation.js"

describe("invalidateCategoryQueries", () => {
  it("invalidates management and both selector scopes for the book", async () => {
    const queryClient = new QueryClient()
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)

    await expect(
      invalidateCategoryQueries(queryClient, { bookId: "book-1" })
    ).resolves.toEqual({ ok: true, failedScopes: [] })

    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: categoryKeys.all("book-1"),
      exact: false,
    })
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: categoryKeys.incomeCategories("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenNthCalledWith(3, {
      queryKey: categoryKeys.expenseCategories("book-1"),
      exact: true,
    })
  })

  it("reports a management refresh failure without rejecting", async () => {
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, "invalidateQueries")
      .mockRejectedValueOnce(new Error("management refresh failed"))
      .mockResolvedValue(undefined)

    await expect(
      invalidateCategoryQueries(queryClient, { bookId: "book-1" })
    ).resolves.toEqual({ ok: false, failedScopes: ["management"] })
  })

  it("reports an income selector refresh failure without rejecting", async () => {
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, "invalidateQueries")
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("income refresh failed"))
      .mockResolvedValueOnce(undefined)

    await expect(
      invalidateCategoryQueries(queryClient, { bookId: "book-1" })
    ).resolves.toEqual({ ok: false, failedScopes: ["income"] })
  })

  it("reports all failed refresh scopes while preserving the settled result", async () => {
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, "invalidateQueries")
      .mockRejectedValueOnce(new Error("management refresh failed"))
      .mockRejectedValueOnce(new Error("income refresh failed"))
      .mockRejectedValueOnce(new Error("expense refresh failed"))

    await expect(
      invalidateCategoryQueries(queryClient, { bookId: "book-1" })
    ).resolves.toEqual({
      ok: false,
      failedScopes: ["management", "income", "expense"],
    })
  })

  it("never redirects invalidation to another book", async () => {
    const queryClient = new QueryClient()
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)

    await invalidateCategoryQueries(queryClient, { bookId: "book-2" })

    expect(invalidate).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: categoryKeys.all("book-1") })
    )
    expect(invalidate.mock.calls.flat()).not.toContain("book-1")
  })
})
