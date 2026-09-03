/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import {
  TransactionMutationInFlightError,
  useTransactionMutation,
} from "./transaction-mutation.js"

type Command = { readonly bookId: string; readonly accountId: string }

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={queryClient}>
        <ActiveBookProvider
          initial={{ status: "ACTIVE", bookId: "book-active" }}
        >
          {children}
        </ActiveBookProvider>
      </MyFinQueryProvider>
    )
  }
}

function setup(
  execute = vi.fn().mockResolvedValue({ ok: true, value: "saved" })
) {
  const client = new QueryClient()
  vi.spyOn(client, "invalidateQueries").mockResolvedValue()
  const refresh = vi.fn((command: Command) => ({
    bookId: command.bookId,
    accountIds: [command.accountId],
  }))
  const hook = renderHook(
    () => ({
      mutation: useTransactionMutation({ execute, refresh }),
      activeBook: useActiveBook(),
    }),
    { wrapper: wrapperFor(client) }
  )
  return { client, execute, refresh, ...hook }
}

describe("useTransactionMutation", () => {
  it("disables automatic retry and returns both command value and refresh outcome", async () => {
    const { result } = setup()
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).resolves.toEqual({
      value: "saved",
      refresh: { ok: true, failedScopes: [] },
    })
    expect(result.current.mutation.failureCount).toBe(0)
  })

  it("rejects a second submission while the first command is pending", async () => {
    let release!: (result: { ok: true; value: string }) => void
    const execute = vi.fn(
      () =>
        new Promise<{ ok: true; value: string }>(
          (resolve) => (release = resolve)
        )
    )
    const { result } = setup(execute)
    const first = result.current.mutation.mutateAsync({
      bookId: "book-1",
      accountId: "account-1",
    })
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).rejects.toBeInstanceOf(TransactionMutationInFlightError)
    expect(execute).toHaveBeenCalledTimes(1)
    release({ ok: true, value: "saved" })
    await expect(first).resolves.toMatchObject({ value: "saved" })
  })

  it("keeps a service failure distinct and does not refresh projections", async () => {
    const error = new Error("service failure")
    const execute = vi.fn().mockResolvedValue({ ok: false, error })
    const { client, refresh, result } = setup(execute)
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).rejects.toBe(error)
    expect(refresh).not.toHaveBeenCalled()
    expect(client.invalidateQueries).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.mutation.failureCount).toBe(1))
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("keeps a successful command successful when a projection refresh fails", async () => {
    const { client, result } = setup()
    vi.mocked(client.invalidateQueries).mockRejectedValueOnce(
      new Error("offline")
    )
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).resolves.toEqual({
      value: "saved",
      refresh: { ok: false, failedScopes: ["transactions"] },
    })
  })

  it("uses the submitted book for a late refresh after the active context changes", async () => {
    let release!: (result: { ok: true; value: string }) => void
    const execute = vi.fn(
      () =>
        new Promise<{ ok: true; value: string }>(
          (resolve) => (release = resolve)
        )
    )
    const { client, result } = setup(execute)
    const pending = result.current.mutation.mutateAsync({
      bookId: "book-submitted",
      accountId: "account-1",
    })
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    act(() => result.current.activeBook.actions.activate("book-next"))
    release({ ok: true, value: "saved" })
    await pending
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-submitted", "transactions", "list"],
      exact: false,
    })
    expect(client.invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["book-active"]),
      })
    )
  })

  it("releases the guard after a service failure", async () => {
    const error = new Error("service failure")
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error })
      .mockResolvedValueOnce({ ok: true, value: "saved" })
    const { result } = setup(execute)
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).rejects.toBe(error)
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).resolves.toMatchObject({ value: "saved" })
  })

  it("releases the guard after a successful command", async () => {
    const { execute, result } = setup()
    await act(async () => {
      await result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    })
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true))
    await expect(
      result.current.mutation.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
      })
    ).resolves.toMatchObject({ value: "saved" })
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
