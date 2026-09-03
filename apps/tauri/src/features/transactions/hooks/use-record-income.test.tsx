/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type { JournalEntryDto } from "@workspace/application"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { TransactionMutationInFlightError } from "./transaction-mutation.js"
import { useRecordIncome, type RecordIncomeInput } from "./use-record-income.js"

const command: RecordIncomeInput = {
  bookId: "book-1",
  draft: {
    type: "INCOME",
    accountId: "account-1",
    categoryId: "category-1",
    amountMinor: "1000",
    currency: "BRL",
    occurredOn: "2026-09-03",
    description: "Pagamento",
  },
}

const entry: JournalEntryDto = {
  id: "entry-1",
  bookId: "book-1",
  occurredOn: "2026-09-03",
  description: "Pagamento",
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
    income: { record: { execute: record } },
    expenses: {} as never,
    transfers: {} as never,
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
  const hook = renderHook(() => useRecordIncome(), {
    wrapper: wrapperFor(services(record), client),
  })
  return { client, record, ...hook }
}

describe("useRecordIncome", () => {
  it("maps one valid income draft to the exact journal command", async () => {
    const { record, result } = setup()
    await expect(result.current.mutateAsync(command)).resolves.toMatchObject({
      value: entry,
    })
    expect(record).toHaveBeenCalledOnce()
    expect(record).toHaveBeenCalledWith({
      bookId: "book-1",
      accountId: "account-1",
      categoryId: "category-1",
      amountMinor: "1000",
      currency: "BRL",
      occurredOn: "2026-09-03",
      description: "Pagamento",
    })
  })

  it("refreshes only the submitted book and affected financial account", async () => {
    const { client, result } = setup()
    await result.current.mutateAsync(command)
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "transactions", "list"],
      exact: false,
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["books", "book-1", "accounts", "account-1", "statement"],
      exact: true,
    })
  })

  it("rejects a duplicate income submit while the first command is pending", async () => {
    let release!: (value: { ok: true; value: JournalEntryDto }) => void
    const record = vi.fn(
      () =>
        new Promise<{ ok: true; value: JournalEntryDto }>(
          (resolve) => (release = resolve)
        )
    )
    const { result } = setup(record)
    const first = result.current.mutateAsync(command)
    await waitFor(() => expect(record).toHaveBeenCalledOnce())
    await expect(result.current.mutateAsync(command)).rejects.toBeInstanceOf(
      TransactionMutationInFlightError
    )
    release({ ok: true, value: entry })
    await expect(first).resolves.toMatchObject({ value: entry })
  })

  it("exposes a service error without changing the caller draft", async () => {
    const error = new Error("offline")
    const record = vi.fn().mockResolvedValue({ ok: false, error })
    const submitted = structuredClone(command)
    const { result } = setup(record)
    await expect(result.current.mutateAsync(submitted)).rejects.toBe(error)
    expect(submitted).toEqual(command)
    expect(record).toHaveBeenCalledOnce()
  })

  it("returns a refresh warning without rejecting a recorded income", async () => {
    const { client, result } = setup()
    vi.mocked(client.invalidateQueries).mockRejectedValueOnce(
      new Error("offline")
    )
    await expect(result.current.mutateAsync(command)).resolves.toEqual({
      value: entry,
      refresh: { ok: false, failedScopes: ["transactions"] },
    })
  })

  it("releases the submit guard after a successful income command", async () => {
    const { record, result } = setup()
    await act(async () => {
      await result.current.mutateAsync(command)
    })
    await expect(result.current.mutateAsync(command)).resolves.toMatchObject({
      value: entry,
    })
    expect(record).toHaveBeenCalledTimes(2)
  })
})
