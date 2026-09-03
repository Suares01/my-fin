/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type {
  AmendJournalEntryResult,
  JournalChainDetail,
} from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { TransactionMutationInFlightError } from "./transaction-mutation.js"
import {
  useAmendTransaction,
  type AmendTransactionInput,
} from "./use-amend-transaction.js"

const result: AmendJournalEntryResult = {
  targetId: "entry-1",
  reversalId: "entry-2",
  replacementId: "entry-3",
  replacementVersion: 2,
  state: "EFFECTIVE",
}

const detail = {
  chainId: "chain-1",
  financialAccounts: [{ id: "account-old", name: "Conta renomeada" }],
} as unknown as JournalChainDetail

function input(
  replacement: AmendTransactionInput["replacement"]
): AmendTransactionInput {
  return {
    bookId: "book-1",
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    replacement,
    previousDetail: detail,
  }
}

const income = input({
  type: "INCOME",
  accountId: "account-1",
  categoryId: "category-1",
  amountMinor: "100",
  currency: "BRL",
  occurredOn: "2026-09-03",
  description: "Salário",
})
const expense = input({
  type: "EXPENSE",
  accountId: "account-2",
  categoryId: "category-2",
  amountMinor: "200",
  currency: "BRL",
  occurredOn: "2026-09-03",
  description: "Mercado",
})
const transfer = input({
  type: "TRANSFER",
  sourceAccountId: "account-3",
  destinationAccountId: "account-4",
  amountMinor: "300",
  currency: "BRL",
  occurredOn: "2026-09-03",
  description: "Reserva",
})

function services(
  amend = vi.fn().mockResolvedValue({ ok: true, value: result })
) {
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {} as never,
    income: {} as never,
    expenses: {} as never,
    transfers: {} as never,
    journal: { amend: { execute: amend } },
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

function setup(amend = vi.fn().mockResolvedValue({ ok: true, value: result })) {
  const client = new QueryClient()
  vi.spyOn(client, "invalidateQueries").mockResolvedValue()
  vi.spyOn(client, "refetchQueries").mockResolvedValue()
  const hook = renderHook(
    () => ({ mutation: useAmendTransaction(), activeBook: useActiveBook() }),
    { wrapper: wrapperFor(services(amend), client) }
  )
  return { client, amend, ...hook }
}

function expectedCommand(value: AmendTransactionInput) {
  return {
    bookId: value.bookId,
    journalEntryId: value.presentedEntryId,
    expectedVersion: value.presentedVersion,
    replacement: value.replacement,
  }
}

describe("useAmendTransaction", () => {
  it("maps an income replacement with the presented identity", async () => {
    const { amend, result: hook } = setup()
    await hook.current.mutation.mutateAsync(income)
    expect(amend).toHaveBeenCalledWith(expectedCommand(income))
  })
  it("maps an expense replacement with the presented identity", async () => {
    const { amend, result: hook } = setup()
    await hook.current.mutation.mutateAsync(expense)
    expect(amend).toHaveBeenCalledWith(expectedCommand(expense))
  })
  it("maps a transfer replacement with the presented identity", async () => {
    const { amend, result: hook } = setup()
    await hook.current.mutation.mutateAsync(transfer)
    expect(amend).toHaveBeenCalledWith(expectedCommand(transfer))
  })
  it("refreshes the union of old and replacement financial accounts", async () => {
    const { client, result: hook } = setup()
    await hook.current.mutation.mutateAsync(income)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "accounts", "account-old", "statement"],
      exact: true,
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "accounts", "account-1", "statement"],
      exact: true,
    })
  })
  it("keeps caller state and projections untouched on an atomic service failure", async () => {
    const error = new Error("failed")
    const amend = vi.fn().mockResolvedValue({ ok: false, error })
    const submitted = structuredClone(income)
    const { client, result: hook } = setup(amend)
    await expect(hook.current.mutation.mutateAsync(submitted)).rejects.toBe(
      error
    )
    expect(submitted).toEqual(income)
    expect(client.invalidateQueries).not.toHaveBeenCalled()
  })
  it("refetches the presented chain and list before releasing an optimistic conflict", async () => {
    let release!: () => void
    const error = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const amend = vi.fn().mockResolvedValue({ ok: false, error })
    const { client, result: hook } = setup(amend)
    const waiting = new Promise<void>((resolve) => (release = resolve))
    vi.mocked(client.refetchQueries).mockImplementation(() => waiting)
    const pending = hook.current.mutation.mutateAsync(income)
    await waitFor(() => expect(client.refetchQueries).toHaveBeenCalledTimes(2))
    expect(client.refetchQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "transactions", "list"],
      exact: false,
    })
    expect(client.refetchQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "transactions", "detail", "chain-1"],
      exact: true,
    })
    release()
    await expect(pending).rejects.toBe(error)
  })
  it("rejects a resubmission while optimistic conflict recovery is pending", async () => {
    let release!: () => void
    const error = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const { client, result: hook } = setup(
      vi.fn().mockResolvedValue({ ok: false, error })
    )
    const waiting = new Promise<void>((resolve) => (release = resolve))
    vi.mocked(client.refetchQueries).mockImplementation(() => waiting)
    const pending = hook.current.mutation.mutateAsync(income)
    await waitFor(() => expect(client.refetchQueries).toHaveBeenCalledTimes(2))
    await expect(
      hook.current.mutation.mutateAsync(income)
    ).rejects.toBeInstanceOf(TransactionMutationInFlightError)
    release()
    await expect(pending).rejects.toBe(error)
  })
  it("uses stable account ids when a previous option was renamed", async () => {
    const { client, result: hook } = setup()
    await hook.current.mutation.mutateAsync(income)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "accounts", "account-old", "statement"],
      exact: true,
    })
  })
  it("keeps command success distinct from a refresh warning", async () => {
    const { client, result: hook } = setup()
    vi.mocked(client.invalidateQueries).mockRejectedValueOnce(
      new Error("offline")
    )
    await expect(hook.current.mutation.mutateAsync(income)).resolves.toEqual({
      value: result,
      refresh: { ok: false, failedScopes: ["transactions"] },
    })
  })
  it("refreshes only the submitted book after an active-book switch", async () => {
    let release!: (value: { ok: true; value: AmendJournalEntryResult }) => void
    const amend = vi.fn(
      () =>
        new Promise<{ ok: true; value: AmendJournalEntryResult }>(
          (resolve) => (release = resolve)
        )
    )
    const { client, result: hook } = setup(amend)
    const pending = hook.current.mutation.mutateAsync(income)
    await waitFor(() => expect(amend).toHaveBeenCalledOnce())
    act(() => hook.current.activeBook.actions.activate("book-2"))
    release({ ok: true, value: result })
    await pending
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "transactions", "list"],
      exact: false,
    })
  })
})
