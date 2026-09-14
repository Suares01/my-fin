/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import {
  accountKeys,
  dedupeStatementItems,
  useAccountBalances,
  useAccountStatement,
  useCreateAccount,
  useSetOpeningBalance,
} from "./index.js"
import { MyFinServices } from "../../../bootstrap/create-services.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"

const account = {
  id: "account-1",
  bookId: "book-1",
  name: "Carteira",
  kind: "ASSET",
  status: "ACTIVE",
  version: 1,
} as const

const statementItem = {
  entryId: "entry-1",
  postingId: "posting-1",
  occurredOn: "2026-08-05",
  recordedAt: "2026-08-05T12:00:00.000Z",
  sequence: "9007199254740993",
  description: "Saldo inicial",
  rawAmountMinor: "100000",
  displayAmountMinor: "100000",
  runningBalanceMinor: "100000",
  currency: "BRL",
  origin: "MANUAL",
  counterpartyAccounts: [],
  isReversal: false,
  isReversed: false,
} as const

function services(): MyFinServices {
  return {
    books: {} as never,
    accounts: {
      listBalances: {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { items: [], nextCursor: null },
        }),
      },
      create: {
        execute: vi.fn().mockResolvedValue({ ok: true, value: account }),
      },
      setOpeningBalance: {
        execute: vi
          .fn()
          .mockResolvedValue({ ok: true, value: { id: "entry-1" } }),
      },
      listStatement: {
        execute: vi.fn().mockResolvedValue({
          ok: true,
          value: { items: [], nextCursor: null },
        }),
      },
    } as never,
    categories: {} as never,
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

describe("account data hooks", () => {
  it("keeps balances and statement keys book-scoped", () => {
    expect(accountKeys.balances("book-1")).toEqual([
      "books",
      "book-1",
      "account-balances",
    ])
    expect(accountKeys.statement("book-1", "account-1")).toEqual([
      "books",
      "book-1",
      "accounts",
      "account-1",
      "statement",
    ])
    expect(accountKeys.balances("book-1")).not.toEqual(
      accountKeys.balances("book-2")
    )
  })

  it("loads only asset/liability balances including zero and excluding archived", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.listBalances.execute)
    execute.mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            accountId: "account-1",
            accountName: "Carteira",
            accountKind: "ASSET",
            rawBalanceMinor: "0",
            displayBalanceMinor: "0",
            amountMinor: "0",
            currency: "BRL",
            asOf: null,
            archived: false,
          },
        ],
        nextCursor: null,
      },
    })
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountBalances(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(execute).toHaveBeenCalledWith({
      bookId: "book-1",
      accountKinds: ["ASSET", "LIABILITY"],
      includeArchived: false,
      includeZeroBalance: true,
    })
    expect(result.current.data?.[0]?.amountMinor).toBe("0")
  })

  it("loads archived balances under a distinct query key when requested", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.listBalances.execute)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountBalances(true), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(execute).toHaveBeenCalledWith({
      bookId: "book-1",
      accountKinds: ["ASSET", "LIABILITY"],
      includeArchived: true,
      includeZeroBalance: true,
    })
    expect(
      queryClient.getQueryData(accountKeys.balances("book-1", true))
    ).toBeDefined()
    expect(
      queryClient.getQueryData(accountKeys.balances("book-1"))
    ).toBeUndefined()
  })

  it("does not query balances without an active book", () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountBalances(), {
      wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
        return (
          <MyFinQueryProvider client={queryClient}>
            <MyFinProvider services={serviceFacade}>
              <ActiveBookProvider>{children}</ActiveBookProvider>
            </MyFinProvider>
          </MyFinQueryProvider>
        )
      },
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.accounts.listBalances.execute).not.toHaveBeenCalled()
  })

  it("turns a balance Result failure into query error without returning data", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.accounts.listBalances.execute).mockResolvedValue({
      ok: false,
      error: new Error("safe"),
    } as never)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useAccountBalances(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("creates an account with the command payload and no retry", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.create.execute)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useCreateAccount(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({
        bookId: "book-1",
        name: "Carteira",
        type: "OTHER_ASSET",
      })
    })
    expect(execute).toHaveBeenCalledWith({
      bookId: "book-1",
      name: "Carteira",
      type: "OTHER_ASSET",
    })
    expect(result.current.failureCount).toBe(0)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it("invalidates only the affected balances key after account creation", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useCreateAccount(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({
        bookId: "book-1",
        name: "Carteira",
        type: "OTHER_ASSET",
      })
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: accountKeys.balances("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it("does not invalidate balances when account creation fails", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.accounts.create.execute).mockResolvedValue({
      ok: false,
      error: new Error("duplicate"),
    } as never)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useCreateAccount(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await expect(
      act(async () => {
        await result.current.mutateAsync({
          bookId: "book-1",
          name: "Carteira",
          type: "OTHER_ASSET",
        })
      })
    ).rejects.toThrow("duplicate")
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("sets opening balance with exact minor, currency, date and description", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.setOpeningBalance.execute)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useSetOpeningBalance(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    const command = {
      bookId: "book-1",
      accountId: "account-1",
      amountMinor: "12345",
      currency: "BRL",
      occurredOn: "2026-08-05",
      description: "Saldo inicial",
    }
    await act(async () => {
      await result.current.mutateAsync(command)
    })
    expect(execute).toHaveBeenCalledWith(command)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: "entry-1" })
  })

  it("invalidates balances, selected detail and statement after opening balance success", async () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useSetOpeningBalance(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await act(async () => {
      await result.current.mutateAsync({
        bookId: "book-1",
        accountId: "account-1",
        amountMinor: "100",
        currency: "BRL",
        occurredOn: "2026-08-05",
        description: "Saldo inicial",
      })
    })
    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: accountKeys.balances("book-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: accountKeys.detail("book-1", "account-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenNthCalledWith(3, {
      queryKey: accountKeys.statement("book-1", "account-1"),
      exact: true,
    })
    expect(invalidate).toHaveBeenCalledTimes(3)
  })

  it("preserves previous statement data when the next page fails", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.listStatement.execute)
    execute.mockResolvedValueOnce({
      ok: true,
      value: { items: [statementItem], nextCursor: "cursor-2" },
    } as never)
    execute.mockRejectedValueOnce(new Error("cursor invalid"))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useAccountStatement("account-1"), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
    expect(result.current.data?.items).toEqual([statementItem])
  })

  it("loads the first statement page with the account and fixed limit", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.listStatement.execute)
    execute.mockResolvedValue({
      ok: true,
      value: { items: [statementItem], nextCursor: "cursor-2" },
    } as never)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountStatement("account-1"), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
    expect(execute).toHaveBeenCalledWith({
      bookId: "book-1",
      accountId: "account-1",
      limit: 20,
    })
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.data?.nextCursor).toBe("cursor-2")
  })

  it("requests the next statement page by opaque cursor", async () => {
    const serviceFacade = services()
    const execute = vi.mocked(serviceFacade.accounts.listStatement.execute)
    execute.mockResolvedValueOnce({
      ok: true,
      value: { items: [statementItem], nextCursor: "cursor-2" },
    } as never)
    execute.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [
          { ...statementItem, entryId: "entry-2", postingId: "posting-2" },
        ],
        nextCursor: null,
      },
    } as never)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountStatement("account-1"), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    expect(execute).toHaveBeenNthCalledWith(2, {
      bookId: "book-1",
      accountId: "account-1",
      limit: 20,
      cursor: "cursor-2",
    })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2))
    expect(result.current.data?.items.map((item) => item.entryId)).toEqual([
      "entry-1",
      "entry-2",
    ])
  })

  it("deduplicates overlapping statement pages without losing order", () => {
    const duplicate = { ...statementItem, description: "duplicate" }
    expect(
      dedupeStatementItems([
        { items: [statementItem], nextCursor: "next" },
        {
          items: [
            duplicate,
            { ...statementItem, entryId: "entry-2", postingId: "posting-2" },
          ],
          nextCursor: null,
        },
      ]).map((item) => item.description)
    ).toEqual(["Saldo inicial", "Saldo inicial"])
  })

  it("keeps statement queries disabled until both scopes exist", () => {
    const serviceFacade = services()
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountStatement(undefined), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    expect(result.current.fetchStatus).toBe("idle")
    expect(serviceFacade.accounts.listStatement.execute).not.toHaveBeenCalled()
  })

  it("surfaces a statement Result failure without inventing empty items", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.accounts.listStatement.execute).mockResolvedValue({
      ok: false,
      error: new Error("safe"),
    } as never)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useAccountStatement("account-1"), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("keeps a statement mutation error from invalidating any query", async () => {
    const serviceFacade = services()
    vi.mocked(
      serviceFacade.accounts.setOpeningBalance.execute
    ).mockResolvedValue({ ok: false, error: new Error("already set") } as never)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useSetOpeningBalance(), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await expect(
      act(async () => {
        await result.current.mutateAsync({
          bookId: "book-1",
          accountId: "account-1",
          amountMinor: "100",
          currency: "BRL",
          occurredOn: "2026-08-05",
          description: "Saldo inicial",
        })
      })
    ).rejects.toThrow("already set")
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("returns the backend statement values including exact large sequence and balance", async () => {
    const serviceFacade = services()
    vi.mocked(serviceFacade.accounts.listStatement.execute).mockResolvedValue({
      ok: true,
      value: { items: [statementItem], nextCursor: null },
    } as never)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useAccountStatement("account-1"), {
      wrapper: wrapperFor(serviceFacade, queryClient),
    })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
    expect(result.current.data?.items[0]).toMatchObject({
      sequence: "9007199254740993",
      runningBalanceMinor: "100000",
      description: "Saldo inicial",
    })
  })
})
