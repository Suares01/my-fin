/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import type { MyFinServices } from "../../../bootstrap/create-services.js"
import { ActiveBookProvider } from "../../../providers/active-book-provider.js"
import { MyFinProvider } from "../../../providers/my-fin-provider.js"
import { MyFinQueryProvider } from "../../../providers/query-provider.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import {
  InvestmentSubmissionBookError,
  InvestmentSubmissionInFlightError,
  useInvestmentSubmission,
} from "./index.js"

type Draft = { readonly amount: string }
type Execute = (command: {
  readonly bookId: string
  readonly requestId: string
  readonly draft: Draft
}) => Promise<
  | { readonly ok: true; readonly value: typeof mutationResult }
  | { readonly ok: false; readonly error: unknown }
>
type ExecutionResult = Awaited<ReturnType<Execute>>

const mutationResult = {
  requestId: "request-1",
  positionId: "position-1",
  journalEntryIds: [],
  warnings: [],
} as const

function services(): MyFinServices {
  return {
    books: {} as never,
    accounts: {} as never,
    categories: {} as never,
    income: {} as never,
    expenses: {} as never,
    transfers: {} as never,
    journal: {} as never,
    insights: {} as never,
    investments: {
      requests: { get: vi.fn().mockResolvedValue(null) },
    } as never,
  }
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

function setup(input: {
  readonly intentKey?: string
  readonly execute?: Execute
  readonly ids?: readonly string[]
  readonly active?: boolean
} = {}) {
  const serviceFacade = services()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(client, "invalidateQueries").mockResolvedValue()
  const execute = input.execute ?? vi.fn().mockResolvedValue({ ok: true, value: mutationResult })
  const ids = [...(input.ids ?? ["request-1", "request-2", "request-3"])]
  const wrapper = input.active === false
    ? function Wrapper({ children }: { children: React.ReactNode }) {
        return <MyFinQueryProvider client={client}><MyFinProvider services={serviceFacade}><ActiveBookProvider>{children}</ActiveBookProvider></MyFinProvider></MyFinQueryProvider>
      }
    : wrapperFor(serviceFacade, client)
  const hook = renderHook(
    ({ intentKey }) => ({
      submission: useInvestmentSubmission<Draft>({
        intentKey,
        execute,
        createRequestId: () => ids.shift() ?? "request-exhausted",
      }),
      activeBook: useActiveBook(),
    }),
    { initialProps: { intentKey: input.intentKey ?? "draft-1" }, wrapper }
  )
  return { serviceFacade, client, execute, ...hook }
}

describe("useInvestmentSubmission", () => {
  it("creates a request id for a new draft", () => {
    const { result } = setup()
    expect(result.current.submission.requestId).toBe("request-1")
  })

  it("keeps the request id for a retry of unchanged content", async () => {
    const { execute, result } = setup()
    await act(async () => result.current.submission.submit({ amount: "100" }))
    await act(async () => result.current.submission.submit({ amount: "100" }))
    expect(execute).toHaveBeenNthCalledWith(1, { bookId: "book-1", requestId: "request-1", draft: { amount: "100" } })
    expect(execute).toHaveBeenNthCalledWith(2, { bookId: "book-1", requestId: "request-1", draft: { amount: "100" } })
  })

  it("creates a new request id only when the draft intent changes", async () => {
    const { execute, result, rerender } = setup({ ids: ["request-1", "request-2"] })
    rerender({ intentKey: "draft-1" })
    expect(result.current.submission.requestId).toBe("request-1")
    rerender({ intentKey: "draft-2" })
    expect(result.current.submission.requestId).toBe("request-2")
    await act(async () => result.current.submission.submit({ amount: "200" }))
    expect(execute).toHaveBeenCalledWith({ bookId: "book-1", requestId: "request-2", draft: { amount: "200" } })
  })

  it("submits through the active book captured at confirmation", async () => {
    const { execute, result } = setup()
    await act(async () => result.current.submission.submit({ amount: "100" }))
    expect(execute).toHaveBeenCalledWith({ bookId: "book-1", requestId: "request-1", draft: { amount: "100" } })
  })

  it("returns a negative-cash warning as a successful mutation", async () => {
    const warning = { code: "INVESTMENT_CASH_NEGATIVE", investmentAccountId: "account-1", cashMinor: "-100", currency: "BRL", asOf: "2026-09-20" } as const
    const { result } = setup({ execute: vi.fn().mockResolvedValue({ ok: true, value: { ...mutationResult, warnings: [warning] } }) })
    await expect(result.current.submission.submit({ amount: "100" })).resolves.toMatchObject({ warnings: [warning] })
    expect(result.current.submission.error).toBeUndefined()
  })

  it("rejects a second concurrent submit before it reaches the command", async () => {
    let release!: () => void
    const execute = vi.fn(() => new Promise<ExecutionResult>((resolve) => { release = () => resolve({ ok: true, value: mutationResult }) }))
    const { result } = setup({ execute })
    const first = result.current.submission.submit({ amount: "100" })
    await expect(result.current.submission.submit({ amount: "100" })).rejects.toBeInstanceOf(InvestmentSubmissionInFlightError)
    release()
    await first
    expect(execute).toHaveBeenCalledOnce()
  })

  it("keeps the same request id after a command error so the user can retry", async () => {
    const { execute, result } = setup({ execute: vi.fn().mockResolvedValue({ ok: false, error: { code: "OFFLINE" } }) })
    await expect(result.current.submission.submit({ amount: "100" })).rejects.toMatchObject({ code: "OFFLINE" })
    await expect(result.current.submission.submit({ amount: "100" })).rejects.toMatchObject({ code: "OFFLINE" })
    expect(execute).toHaveBeenNthCalledWith(2, { bookId: "book-1", requestId: "request-1", draft: { amount: "100" } })
  })

  it("recovers an indeterminate response from the persisted receipt", async () => {
    const { serviceFacade, result } = setup({ execute: vi.fn().mockResolvedValue({ ok: false, error: { code: "UNKNOWN_COMMIT" } }) })
    vi.mocked(serviceFacade.investments.requests.get).mockResolvedValue({
      bookId: "book-1", requestId: "request-1", formatVersion: 1, canonicalCommand: "{}", recordedAt: "2026-09-20T10:00:00.000Z", result: mutationResult,
    })
    await expect(result.current.submission.submit({ amount: "100" })).resolves.toEqual(mutationResult)
    expect(serviceFacade.investments.requests.get).toHaveBeenCalledWith({ bookId: "book-1", requestId: "request-1" })
  })

  it("preserves an unconfirmed error when no receipt exists", async () => {
    const { result } = setup({ execute: vi.fn().mockResolvedValue({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } }) })
    await expect(result.current.submission.submit({ amount: "100" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" })
    await waitFor(() => expect(result.current.submission.error).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" }))
  })

  it("does not submit without an active book", async () => {
    const { execute, result } = setup({ active: false })
    await expect(result.current.submission.submit({ amount: "100" })).rejects.toBeInstanceOf(InvestmentSubmissionBookError)
    expect(execute).not.toHaveBeenCalled()
  })

  it("marks the hook pending until the command settles", async () => {
    let release!: () => void
    const { result } = setup({ execute: vi.fn(() => new Promise<ExecutionResult>((resolve) => { release = () => resolve({ ok: true, value: mutationResult }) })) })
    const pending = result.current.submission.submit({ amount: "100" })
    await waitFor(() => expect(result.current.submission.isPending).toBe(true))
    release()
    await pending
    await waitFor(() => expect(result.current.submission.isPending).toBe(false))
  })

  it("invalidates only the submitted book investment scope on success", async () => {
    const { client, result } = setup()
    await act(async () => result.current.submission.submit({ amount: "100" }))
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["investments", "book-1"], exact: false })
    expect(client.invalidateQueries).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["investments", "book-2"] }))
  })

  it("refreshes transactions, balances and insights after a confirmed mutation", async () => {
    const { client, result } = setup()
    await act(async () => result.current.submission.submit({ amount: "100" }))
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["books", "book-1", "transactions", "list"], exact: false })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["books", "book-1", "account-balances"], exact: true })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["books", "book-1", "insights"], exact: false })
  })

  it("uses the submitted book for a late response after the active book changes", async () => {
    let release!: () => void
    const { client, result } = setup({ execute: vi.fn(() => new Promise<ExecutionResult>((resolve) => { release = () => resolve({ ok: true, value: mutationResult }) })) })
    const pending = result.current.submission.submit({ amount: "100" })
    act(() => result.current.activeBook.actions.activate("book-2"))
    release()
    await pending
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["investments", "book-1"], exact: false })
    expect(client.invalidateQueries).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["investments", "book-2"] }))
  })

  it("clears a prior error when the next submit starts", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: "OFFLINE" } })
      .mockResolvedValueOnce({ ok: true, value: mutationResult })
    const { result } = setup({ execute })
    await expect(result.current.submission.submit({ amount: "100" })).rejects.toMatchObject({ code: "OFFLINE" })
    await act(async () => result.current.submission.submit({ amount: "100" }))
    expect(result.current.submission.error).toBeUndefined()
  })

  it("does not ask for a receipt when the command already confirms success", async () => {
    const { serviceFacade, result } = setup()
    await act(async () => result.current.submission.submit({ amount: "100" }))
    expect(serviceFacade.investments.requests.get).not.toHaveBeenCalled()
  })
})
