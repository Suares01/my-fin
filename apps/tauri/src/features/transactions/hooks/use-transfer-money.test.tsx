/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type { JournalEntryDto } from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { TransactionMutationInFlightError } from "./transaction-mutation.js"
import {
  EqualTransferAccountsError,
  useTransferMoney,
  type TransferMoneyInput,
} from "./use-transfer-money.js"

const command: TransferMoneyInput = {
  bookId: "book-1",
  draft: {
    type: "TRANSFER",
    sourceAccountId: "account-source",
    destinationAccountId: "account-destination",
    amountMinor: "1000",
    currency: "BRL",
    occurredOn: "2026-09-03",
    description: "Reserva",
  },
}

const entry: JournalEntryDto = {
  id: "entry-1",
  bookId: "book-1",
  occurredOn: "2026-09-03",
  description: "Reserva",
  currency: "BRL",
  version: 1,
}

function services(
  record = vi.fn().mockResolvedValue({ ok: true, value: entry })
) {
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {} as never,
    income: {} as never,
    expenses: {} as never,
    transfers: { record: { execute: record } },
    journal: {} as never,
    insights: {} as never,
  } as unknown as MyFinServices
}

function wrapperFor(serviceFacade: MyFinServices, client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MyFinQueryProvider client={client}>
        <MyFinProvider services={serviceFacade}>
          <ActiveBookProvider initial={{ status: "ACTIVE", bookId: "book-1" }}>
            {children}
          </ActiveBookProvider>
        </MyFinProvider>
      </MyFinQueryProvider>
    )
  }
}

function setup(record = vi.fn().mockResolvedValue({ ok: true, value: entry })) {
  const client = new QueryClient()
  vi.spyOn(client, "invalidateQueries").mockResolvedValue()
  const hook = renderHook(
    () => ({ mutation: useTransferMoney(), activeBook: useActiveBook() }),
    { wrapper: wrapperFor(services(record), client) }
  )
  return { client, record, ...hook }
}

describe("useTransferMoney", () => {
  it("maps one valid transfer draft to the exact transfer command", async () => {
    const { record, result } = setup()
    await expect(
      result.current.mutation.mutateAsync(command)
    ).resolves.toMatchObject({
      value: entry,
    })
    expect(record).toHaveBeenCalledOnce()
    expect(record).toHaveBeenCalledWith({
      bookId: "book-1",
      sourceAccountId: "account-source",
      destinationAccountId: "account-destination",
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-09-03",
      description: "Reserva",
    })
  })

  it("refreshes both distinct affected accounts under the submitted book", async () => {
    const { client, result } = setup()
    await result.current.mutation.mutateAsync(command)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "accounts", "account-source", "statement"],
      exact: true,
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "books",
        "book-1",
        "accounts",
        "account-destination",
        "statement",
      ],
      exact: true,
    })
  })

  it("rejects equal accounts before calling the transfer service", async () => {
    const { record, result } = setup()
    await expect(
      result.current.mutation.mutateAsync({
        ...command,
        draft: { ...command.draft, destinationAccountId: "account-source" },
      })
    ).rejects.toBeInstanceOf(EqualTransferAccountsError)
    expect(record).not.toHaveBeenCalled()
  })

  it("rejects a duplicate transfer while the first command is pending", async () => {
    let release!: (value: { ok: true; value: JournalEntryDto }) => void
    const record = vi.fn(
      () =>
        new Promise<{ ok: true; value: JournalEntryDto }>(
          (resolve) => (release = resolve)
        )
    )
    const { result } = setup(record)
    const first = result.current.mutation.mutateAsync(command)
    await waitFor(() => expect(record).toHaveBeenCalledOnce())
    await expect(
      result.current.mutation.mutateAsync(command)
    ).rejects.toBeInstanceOf(TransactionMutationInFlightError)
    release({ ok: true, value: entry })
    await expect(first).resolves.toMatchObject({ value: entry })
  })

  it("preserves caller data on a transfer service failure", async () => {
    const error = new Error("offline")
    const record = vi.fn().mockResolvedValue({ ok: false, error })
    const submitted = structuredClone(command)
    const { result } = setup(record)
    await expect(result.current.mutation.mutateAsync(submitted)).rejects.toBe(
      error
    )
    expect(submitted).toEqual(command)
  })

  it("keeps refresh warnings distinct from transfer command success", async () => {
    const { client, result } = setup()
    vi.mocked(client.invalidateQueries).mockRejectedValueOnce(
      new Error("offline")
    )
    await expect(result.current.mutation.mutateAsync(command)).resolves.toEqual(
      {
        value: entry,
        refresh: { ok: false, failedScopes: ["transactions"] },
      }
    )
  })

  it("refreshes the submitted book after a late completion and active-book switch", async () => {
    let release!: (value: { ok: true; value: JournalEntryDto }) => void
    const record = vi.fn(
      () =>
        new Promise<{ ok: true; value: JournalEntryDto }>(
          (resolve) => (release = resolve)
        )
    )
    const { client, result } = setup(record)
    const pending = result.current.mutation.mutateAsync(command)
    await waitFor(() => expect(record).toHaveBeenCalledOnce())
    act(() => result.current.activeBook.actions.activate("book-2"))
    release({ ok: true, value: entry })
    await pending
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "transactions", "list"],
      exact: false,
    })
  })
})
