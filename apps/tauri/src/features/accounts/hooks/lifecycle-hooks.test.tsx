/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { accountKeys } from "./account-keys.js"
import {
  useArchiveAccount,
  useReactivateAccount,
  useRenameAccount,
} from "./index.js"
import { MyFinServices } from "../../../bootstrap/create-services.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import {
  useArchiveCategory,
  useReactivateCategory,
  useUpdateCategory,
} from "../../categories/hooks/use-category-lifecycle.js"
import { categoryKeys } from "../../categories/hooks/category-keys.js"

const account = {
  id: "account-1",
  bookId: "book-1",
  name: "Conta",
  kind: "ASSET",
  status: "ACTIVE",
  version: 2,
} as const
const accountCommand = {
  bookId: "book-1",
  accountId: "account-1",
  expectedVersion: 2,
} as const
const categoryCommand = {
  bookId: "book-1",
  categoryId: "category-1",
  expectedVersion: 4,
} as const
const categoryUpdateCommand = {
  ...categoryCommand,
  name: "Categoria nova",
  iconKey: "restaurant",
  colorHex: "abcdef",
} as const

function services(): MyFinServices {
  const handler = () => ({
    execute: vi.fn().mockResolvedValue({ ok: true, value: account }),
  })
  return {
    books: {} as never,
    accounts: {
      rename: handler(),
      archive: handler(),
      reactivate: handler(),
    } as never,
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

describe("account and category lifecycle hooks", () => {
  it("renames an account without submitting kind", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useRenameAccount(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    const command = { ...accountCommand, name: "Conta nova" }
    await act(async () => {
      await result.current.mutateAsync(command)
    })
    expect(serviceFacade.accounts.rename.execute).toHaveBeenCalledWith(command)
    expect(serviceFacade.accounts.rename.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: expect.anything() })
    )
  })

  it("archives an account with the expected version", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useArchiveAccount(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(accountCommand)
    })
    expect(serviceFacade.accounts.archive.execute).toHaveBeenCalledWith(
      accountCommand
    )
  })

  it("reactivates an account idempotently through the service", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useReactivateAccount(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(accountCommand)
    })
    expect(serviceFacade.accounts.reactivate.execute).toHaveBeenCalledWith(
      accountCommand
    )
    await waitFor(() => expect(result.current.data?.status).toBe("ACTIVE"))
  })

  it("invalidates account directory, detail and statement views", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useRenameAccount(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({ ...accountCommand, name: "Nova" })
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.balances("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.detail("book-1", "account-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.statement("book-1", "account-1"),
      exact: true,
    })
  })

  it("keeps account lifecycle failure actionable without invalidating", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.accounts.archive.execute).mockResolvedValue({
      ok: false,
      error: new Error("stale"),
    } as never)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useArchiveAccount(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await expect(
      act(async () => {
        await result.current.mutateAsync(accountCommand)
      })
    ).rejects.toThrow("stale")
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("updates a category without submitting kind", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(categoryUpdateCommand)
    })
    expect(serviceFacade.categories.update.execute).toHaveBeenCalledWith(
      categoryUpdateCommand
    )
    expect(serviceFacade.categories.update.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: expect.anything() })
    )
  })

  it("archives a category using its current expected version", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(categoryCommand)
    })
    expect(serviceFacade.categories.archive.execute).toHaveBeenCalledWith(
      categoryCommand
    )
  })

  it("reactivates a category through the category service group", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useReactivateCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(categoryCommand)
    })
    expect(serviceFacade.categories.reactivate.execute).toHaveBeenCalledWith(
      categoryCommand
    )
  })

  it("invalidates category selectors and management lists after rename", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({
        ...categoryUpdateCommand,
        name: "Nova",
      })
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: categoryKeys.all("book-1"),
      exact: false,
    })
    expect(invalidate).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: categoryKeys.all("book-2") })
    )
  })

  it("preserves a category version and does not fabricate totals", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.reactivate.execute).mockResolvedValue({
      ok: true,
      value: { ...account, id: "category-1", version: 5, status: "ACTIVE" },
    } as never)
    const { result } = renderHook(() => useReactivateCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(categoryCommand)
    })
    await waitFor(() =>
      expect(result.current.data?.value).toMatchObject({
        id: "category-1",
        version: 5,
        status: "ACTIVE",
      })
    )
    expect(result.current.data?.value).not.toHaveProperty("amountMinor")
  })

  it("does not retry category lifecycle failures", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.archive.execute).mockRejectedValue(
      new Error("storage")
    )
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await expect(
      act(async () => {
        await result.current.mutateAsync(categoryCommand)
      })
    ).rejects.toThrow("storage")
    expect(result.current.failureCount).toBe(0)
  })

  it("keeps account book scope in a rename payload", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useRenameAccount(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync({
        ...accountCommand,
        bookId: "book-2",
        name: "Outra",
      })
    })
    expect(serviceFacade.accounts.rename.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-2",
        accountId: "account-1",
        expectedVersion: 2,
      })
    )
  })

  it("does not submit a category kind when archiving", async () => {
    const serviceFacade = services()
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(categoryCommand)
    })
    expect(serviceFacade.categories.archive.execute).toHaveBeenCalledWith(
      expect.not.objectContaining({ kind: expect.anything() })
    )
  })

  it("returns the service status transition to the category caller", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.categories.archive.execute).mockResolvedValue({
      ok: true,
      value: { ...account, id: "category-1", status: "ARCHIVED" },
    } as never)
    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: wrapperFor(serviceFacade, new QueryClient()),
    })
    await act(async () => {
      await result.current.mutateAsync(categoryCommand)
    })
    await waitFor(() =>
      expect(result.current.data?.value.status).toBe("ARCHIVED")
    )
  })
})
