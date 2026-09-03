/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type {
  JournalChainDetail,
  JournalEntryDto,
} from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { TransactionMutationInFlightError } from "./transaction-mutation.js"
import {
  InvalidCancellationDateError,
  useReverseTransaction,
  type ReverseTransactionInput,
} from "./use-reverse-transaction.js"

const entry: JournalEntryDto = {
  id: "reversal-1",
  bookId: "book-1",
  occurredOn: "2026-09-04",
  description: "Cancelamento",
  currency: "BRL",
  version: 1,
}
const detail = {
  chainId: "chain-1",
  financialAccounts: [{ id: "account-1", name: "Conta" }],
} as unknown as JournalChainDetail
function input(
  status: "ACTIVE" | "EDITED" = "ACTIVE"
): ReverseTransactionInput {
  return {
    bookId: "book-1",
    chainId: "chain-1",
    presentedEntryId: status === "ACTIVE" ? "entry-1" : "entry-3",
    presentedVersion: status === "ACTIVE" ? 1 : 2,
    presentedOccurredOn: "2026-09-03",
    occurredOn: "2026-09-04",
    description: "Cancelamento",
    previousDetail: detail,
  }
}
function services(
  reverse = vi.fn().mockResolvedValue({ ok: true, value: entry })
) {
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {} as never,
    income: {} as never,
    expenses: {} as never,
    transfers: {} as never,
    journal: { reverse: { execute: reverse } },
    insights: {} as never,
  } as unknown as MyFinServices
}
function wrapperFor(facade: MyFinServices, client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={client}>
        <MyFinProvider services={facade}>
          <ActiveBookProvider initial={{ status: "ACTIVE", bookId: "book-1" }}>
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}
function setup(
  reverse = vi.fn().mockResolvedValue({ ok: true, value: entry })
) {
  const client = new QueryClient()
  vi.spyOn(client, "invalidateQueries").mockResolvedValue()
  vi.spyOn(client, "refetchQueries").mockResolvedValue()
  const hook = renderHook(() => useReverseTransaction(), {
    wrapper: wrapperFor(services(reverse), client),
  })
  return { client, reverse, ...hook }
}
function expected(value: ReverseTransactionInput) {
  return {
    bookId: value.bookId,
    journalEntryId: value.presentedEntryId,
    expectedVersion: value.presentedVersion,
    occurredOn: value.occurredOn,
    description: value.description,
  }
}

describe("useReverseTransaction", () => {
  it("maps an active chain to the exact reversal command", async () => {
    const value = input()
    const { reverse, result } = setup()
    await result.current.mutateAsync(value)
    expect(reverse).toHaveBeenCalledWith(expected(value))
  })
  it("maps an edited chain using its latest presented identity", async () => {
    const value = input("EDITED")
    const { reverse, result } = setup()
    await result.current.mutateAsync(value)
    expect(reverse).toHaveBeenCalledWith(expected(value))
  })
  it("rejects a cancellation date before the presented occurrence without calling the service", async () => {
    const { reverse, result } = setup()
    await expect(
      result.current.mutateAsync({ ...input(), occurredOn: "2026-09-02" })
    ).rejects.toBeInstanceOf(InvalidCancellationDateError)
    expect(reverse).not.toHaveBeenCalled()
  })
  it("rejects duplicate confirmation while reversal is pending", async () => {
    let release!: (value: { ok: true; value: JournalEntryDto }) => void
    const reverse = vi.fn(
      () =>
        new Promise<{ ok: true; value: JournalEntryDto }>(
          (resolve) => (release = resolve)
        )
    )
    const { result } = setup(reverse)
    const pending = result.current.mutateAsync(input())
    await waitFor(() => expect(reverse).toHaveBeenCalledOnce())
    await expect(result.current.mutateAsync(input())).rejects.toBeInstanceOf(
      TransactionMutationInFlightError
    )
    release({ ok: true, value: entry })
    await pending
  })
  it("keeps the chain query data on a service failure", async () => {
    const error = new Error("offline")
    const reverse = vi.fn().mockResolvedValue({ ok: false, error })
    const { client, result } = setup(reverse)
    client.setQueryData(
      ["books", "book-1", "transactions", "list"],
      ["chain-1"]
    )
    await expect(result.current.mutateAsync(input())).rejects.toBe(error)
    expect(
      client.getQueryData(["books", "book-1", "transactions", "list"])
    ).toEqual(["chain-1"])
  })
  it("does not remove the chain optimistically while reversal is pending", async () => {
    let release!: (value: { ok: true; value: JournalEntryDto }) => void
    const reverse = vi.fn(
      () =>
        new Promise<{ ok: true; value: JournalEntryDto }>(
          (resolve) => (release = resolve)
        )
    )
    const { client, result } = setup(reverse)
    client.setQueryData(
      ["books", "book-1", "transactions", "list"],
      ["chain-1"]
    )
    const pending = result.current.mutateAsync(input())
    await waitFor(() => expect(reverse).toHaveBeenCalledOnce())
    expect(
      client.getQueryData(["books", "book-1", "transactions", "list"])
    ).toEqual(["chain-1"])
    release({ ok: true, value: entry })
    await pending
  })
  it("refetches list and detail before completing an optimistic conflict", async () => {
    let release!: () => void
    const error = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const { client, result } = setup(
      vi.fn().mockResolvedValue({ ok: false, error })
    )
    const waiting = new Promise<void>((resolve) => (release = resolve))
    vi.mocked(client.refetchQueries).mockImplementation(() => waiting)
    const pending = result.current.mutateAsync(input())
    await waitFor(() => expect(client.refetchQueries).toHaveBeenCalledTimes(2))
    release()
    await expect(pending).rejects.toBe(error)
  })
  it("keeps a successful reversal successful when refresh reports a warning", async () => {
    const { client, result } = setup()
    vi.mocked(client.invalidateQueries).mockRejectedValueOnce(
      new Error("offline")
    )
    await expect(result.current.mutateAsync(input())).resolves.toEqual({
      value: entry,
      refresh: { ok: false, failedScopes: ["transactions"] },
    })
  })
  it("refreshes the submitted account statement after reversal", async () => {
    const { client, result } = setup()
    await result.current.mutateAsync(input())
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "accounts", "account-1", "statement"],
      exact: true,
    })
  })
  it("leaves the submitted command unchanged on a service failure", async () => {
    const error = new Error("offline")
    const reverse = vi.fn().mockResolvedValue({ ok: false, error })
    const submitted = input()
    const { result } = setup(reverse)
    await expect(result.current.mutateAsync(submitted)).rejects.toBe(error)
    expect(submitted).toEqual(input())
  })
})
