import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { accountKeys } from "./accounts/hooks/account-keys.js"
import {
  refreshTransactionProjections,
  type ProjectionRefreshOutcome,
} from "./query-invalidation.js"
import { transactionKeys } from "./transactions/hooks/transaction-keys.js"

function clientWithInvalidation() {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue()
  return { client, invalidate }
}

function seedTransactionProjectionFamilies(
  client: QueryClient,
  bookId: string
) {
  client.setQueryData(transactionKeys.list(bookId, { types: ["INCOME"] }), [])
  client.setQueryData(transactionKeys.detail(bookId, "chain-1"), [])
  client.setQueryData(accountKeys.balances(bookId), [])
  client.setQueryData(accountKeys.statement(bookId, "account-1"), [])
  client.setQueryData(["books", bookId, "insights", "net-worth"], [])
}

describe("refreshTransactionProjections", () => {
  it("refreshes the transaction list, balances, and insights under the submitted book", async () => {
    const { client, invalidate } = clientWithInvalidation()
    seedTransactionProjectionFamilies(client, "book-1")
    await refreshTransactionProjections(client, {
      bookId: "book-1",
      accountIds: [],
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: transactionKeys.lists("book-1"),
      exact: false,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.balances("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "insights"],
      exact: false,
    })
  })

  it("refreshes the stable chain detail only when a chain identity is supplied", async () => {
    const { client, invalidate } = clientWithInvalidation()
    await refreshTransactionProjections(client, {
      bookId: "book-1",
      chainId: "chain-1",
      accountIds: [],
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: transactionKeys.detail("book-1", "chain-1"),
      exact: true,
    })
  })

  it("does not create a detail invalidation without a stable chain identity", async () => {
    const { client, invalidate } = clientWithInvalidation()
    await refreshTransactionProjections(client, {
      bookId: "book-1",
      accountIds: [],
    })
    expect(invalidate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: transactionKeys.detail("book-1", "chain-1"),
      })
    )
  })

  it("refreshes each unique affected account statement", async () => {
    const { client, invalidate } = clientWithInvalidation()
    await refreshTransactionProjections(client, {
      bookId: "book-1",
      accountIds: ["account-1", "account-2", "account-1"],
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.statement("book-1", "account-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.statement("book-1", "account-2"),
      exact: true,
    })
    expect(
      invalidate.mock.calls.filter(
        ([query]) => query?.queryKey?.[4] === "statement"
      )
    ).toHaveLength(2)
  })

  it("reports a successful projection refresh when every scope settles", async () => {
    const { client } = clientWithInvalidation()
    await expect(
      refreshTransactionProjections(client, {
        bookId: "book-1",
        chainId: "chain-1",
        accountIds: ["account-1"],
      })
    ).resolves.toEqual({
      ok: true,
      failedScopes: [],
    } satisfies ProjectionRefreshOutcome)
  })

  it("returns failed scopes instead of throwing when one projection refresh rejects", async () => {
    const { client, invalidate } = clientWithInvalidation()
    invalidate.mockImplementation((filters) => {
      if (filters?.queryKey?.[2] === "account-balances")
        return Promise.reject(new Error("offline"))
      return Promise.resolve()
    })
    await expect(
      refreshTransactionProjections(client, {
        bookId: "book-1",
        accountIds: [],
      })
    ).resolves.toEqual({ ok: false, failedScopes: ["balances"] })
  })

  it("collapses failures from multiple statement refreshes into one retryable scope", async () => {
    const { client, invalidate } = clientWithInvalidation()
    invalidate.mockImplementation((filters) =>
      filters?.queryKey?.[4] === "statement"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve()
    )
    await expect(
      refreshTransactionProjections(client, {
        bookId: "book-1",
        accountIds: ["account-1", "account-2"],
      })
    ).resolves.toEqual({ ok: false, failedScopes: ["statements"] })
  })

  it("keeps pending refreshes scoped to the submitted book after a book switch", async () => {
    const { client, invalidate } = clientWithInvalidation()
    let release!: () => void
    let pendingRefresh = true
    invalidate.mockImplementation(() => {
      if (!pendingRefresh) return Promise.resolve()
      pendingRefresh = false
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })
    const pending = refreshTransactionProjections(client, {
      bookId: "book-1",
      accountIds: ["account-1"],
    })
    await refreshTransactionProjections(client, {
      bookId: "book-2",
      accountIds: ["account-2"],
    })
    release()
    await pending
    expect(
      invalidate.mock.calls.every(
        ([query]) =>
          query?.queryKey?.[1] === "book-1" || query?.queryKey?.[1] === "book-2"
      )
    ).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.balances("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.balances("book-2"),
      exact: true,
    })
  })
})
