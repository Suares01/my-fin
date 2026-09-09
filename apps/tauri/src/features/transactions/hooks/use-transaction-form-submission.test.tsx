/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "@workspace/ui/components/toast"
import { useTransactionFormSubmission } from "./use-transaction-form-submission"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
describe("useTransactionFormSubmission", () => {
  it.each(["prop-first", "catch-first"])(
    "notifies once per failed attempt with %s delivery and allows retries",
    async (order) => {
      const add = vi.spyOn(toast, "add").mockReturnValue("toast-id")
      const error = new Error("offline")
      const onSubmit = vi.fn<() => Promise<void>>()
      let reject!: (error: unknown) => void
      onSubmit.mockImplementation(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail
          })
      )
      const { result, rerender } = renderHook(
        ({ submitError }) =>
          useTransactionFormSubmission({
            onSubmit,
            submitError,
            blocked: false,
          }),
        { initialProps: { submitError: undefined as unknown } }
      )
      for (let attempt = 1; attempt <= 2; attempt++) {
        rerender({ submitError: undefined })
        let submission!: Promise<void>
        act(() => {
          submission = result.current.submit({})
        })
        if (order === "prop-first") rerender({ submitError: error })
        await act(async () => {
          reject(error)
          await submission
        })
        if (order === "catch-first") rerender({ submitError: error })
        expect(add).toHaveBeenCalledTimes(attempt)
      }
      expect(onSubmit).toHaveBeenCalledTimes(2)
    }
  )
  it("holds a synchronous lock against concurrent calls", async () => {
    let finish!: () => void
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const { result } = renderHook(() =>
      useTransactionFormSubmission({ onSubmit, blocked: false })
    )
    let first!: Promise<void>
    act(() => {
      first = result.current.submit({})
    })
    await act(async () => result.current.submit({}))
    expect(onSubmit).toHaveBeenCalledOnce()
    await act(async () => {
      finish()
      await first
    })
  })
  it("uses the configured cancellation toast copy", async () => {
    const add = vi.spyOn(toast, "add").mockReturnValue("toast-id")
    const error = new Error("offline")
    const onSubmit = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() =>
      useTransactionFormSubmission({
        onSubmit,
        blocked: false,
        errorTitle: "Não foi possível cancelar a transação",
        errorAction: "cancelar",
      })
    )

    await act(async () => result.current.submit({}))

    expect(add).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível cancelar a transação",
      description: "Não foi possível cancelar a transação. Tente novamente.",
    })
  })
  it("blocks retries after an optimistic conflict even when the error prop clears", async () => {
    vi.spyOn(toast, "add").mockReturnValue("toast-id")
    const error = { code: "OPTIMISTIC_CONCURRENCY_FAILURE" }
    const onSubmit = vi.fn().mockRejectedValue(error)
    const { result, rerender } = renderHook(
      ({ submitError }) =>
        useTransactionFormSubmission({ onSubmit, submitError, blocked: false }),
      { initialProps: { submitError: undefined as unknown } }
    )
    await act(async () => result.current.submit({}))
    rerender({ submitError: error })
    rerender({ submitError: undefined })
    expect(result.current.conflictLocked).toBe(true)
    await act(async () => result.current.submit({}))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
  it("never submits while blocked", async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useTransactionFormSubmission({ onSubmit, blocked: true })
    )
    await act(async () => result.current.submit({}))
    expect(onSubmit).not.toHaveBeenCalled()
  })
  it("allows a new session even if the mutation retains a previous conflict", async () => {
    vi.spyOn(toast, "add").mockReturnValue("toast-id")
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useTransactionFormSubmission({
        onSubmit,
        blocked: false,
        submitError: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" },
      })
    )
    expect(result.current.conflictLocked).toBe(false)
    await act(async () => result.current.submit({}))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
