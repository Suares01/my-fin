// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  BootstrapError,
  type MyFinRuntime,
} from "../bootstrap/create-runtime.js"
import { useBootstrap, type BootstrapLifecycle } from "./use-bootstrap.js"

type Deferred<T> = {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (error: unknown) => void
}

class FakeLifecycle implements BootstrapLifecycle {
  public callbacks: Parameters<BootstrapLifecycle["subscribe"]>[0] | null = null
  public readonly unsubscribe = vi.fn()
  public readonly subscribe = vi.fn(
    async (callbacks: Parameters<BootstrapLifecycle["subscribe"]>[0]) => {
      this.callbacks = callbacks
      return this.unsubscribe
    }
  )
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function runtimeFixture(
  overrides: Partial<MyFinRuntime> = {}
): MyFinRuntime {
  return {
    services: {} as never,
    health: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve()
    }
    await vi.runAllTimersAsync()
  })
}

describe("useBootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts in STARTING and creates one attempt", async () => {
    const gate = deferred<MyFinRuntime>()
    const lifecycle = new FakeLifecycle()
    const createRuntime = vi.fn(() => gate.promise)
    const { result } = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle })
    )

    expect(result.current.state).toEqual({ status: "STARTING", attempt: 1 })
    expect(createRuntime).toHaveBeenCalledOnce()
    gate.resolve(runtimeFixture())
    await flush()
  })

  it("moves to READY only after runtime and lifecycle subscription", async () => {
    const runtime = runtimeFixture()
    const lifecycle = new FakeLifecycle()
    const { result } = renderHook(() =>
      useBootstrap({
        createRuntime: vi.fn().mockResolvedValue(runtime),
        lifecycle,
      })
    )

    await flush()

    expect(result.current.state).toMatchObject({
      status: "READY",
      attempt: 1,
      runtime,
    })
    expect(lifecycle.subscribe).toHaveBeenCalledOnce()
  })

  it("maps runtime creation failure to a safe FAILED state", async () => {
    const failure = new BootstrapError("MIGRATION_FAILED", "migration-42")
    const lifecycle = new FakeLifecycle()
    const { result } = renderHook(() =>
      useBootstrap({
        createRuntime: vi.fn().mockRejectedValue(failure),
        lifecycle,
      })
    )

    await flush()

    expect(result.current.state).toMatchObject({
      status: "FAILED",
      attempt: 1,
      error: failure,
    })
  })

  it.each([
    "VAULT_OPEN_FAILED",
    "SQLITE_CONFIGURATION_FAILED",
    "SQLITE_CONFIGURATION_MISMATCH",
    "MIGRATION_FAILED",
    "RUNTIME_COMPOSITION_FAILED",
  ] as const)("preserves safe bootstrap code %s", async (code) => {
    const failure = new BootstrapError(code, `diagnostic-${code.toLowerCase()}`)
    const lifecycle = new FakeLifecycle()
    const { result } = renderHook(() =>
      useBootstrap({
        createRuntime: vi.fn().mockRejectedValue(failure),
        lifecycle,
      })
    )

    await flush()

    expect(result.current.state).toMatchObject({
      status: "FAILED",
      error: { code },
    })
  })

  it("does not create a second attempt for concurrent retry calls", async () => {
    const gate = deferred<MyFinRuntime>()
    const createRuntime = vi.fn(() => gate.promise)
    const lifecycle = new FakeLifecycle()
    const { result } = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle })
    )

    act(() => {
      result.current.retry()
      result.current.retry()
    })

    expect(createRuntime).toHaveBeenCalledOnce()
    gate.resolve(runtimeFixture())
    await flush()
  })

  it("retries a FAILED attempt exactly once", async () => {
    const first = deferred<MyFinRuntime>()
    const secondRuntime = runtimeFixture()
    const createRuntime = vi
      .fn<() => Promise<MyFinRuntime>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(secondRuntime)
    const lifecycle = new FakeLifecycle()
    const { result } = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle })
    )

    first.reject(new BootstrapError("VAULT_OPEN_FAILED", "first"))
    await flush()
    expect(result.current.state.status).toBe("FAILED")

    act(() => result.current.retry())
    await flush()

    expect(createRuntime).toHaveBeenCalledTimes(2)
    expect(result.current.state).toMatchObject({
      status: "READY",
      runtime: secondRuntime,
    })
  })

  it("ignores an old attempt after unmount and disposes its late runtime", async () => {
    const first = deferred<MyFinRuntime>()
    const firstRuntime = runtimeFixture()
    const createRuntime = vi.fn(() => first.promise)
    const lifecycle = new FakeLifecycle()
    const { unmount } = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle })
    )

    unmount()
    first.resolve(firstRuntime)
    await flush()

    expect(firstRuntime.dispose).toHaveBeenCalledOnce()
  })

  it("does not let a stale failure replace a newer hook attempt", async () => {
    const oldAttempt = deferred<MyFinRuntime>()
    const newRuntime = runtimeFixture()
    const createRuntime = vi.fn(() => oldAttempt.promise)
    const first = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle: new FakeLifecycle() })
    )
    first.unmount()

    const secondCreate = vi.fn().mockResolvedValue(newRuntime)
    const second = renderHook(() =>
      useBootstrap({
        createRuntime: secondCreate,
        lifecycle: new FakeLifecycle(),
      })
    )
    await flush()
    oldAttempt.reject(new BootstrapError("MIGRATION_FAILED", "old"))
    await flush()

    expect(second.result.current.state).toMatchObject({
      status: "READY",
      runtime: newRuntime,
    })
    second.unmount()
  })

  it("health-checks on resume without recreating a healthy runtime", async () => {
    const runtime = runtimeFixture()
    const lifecycle = new FakeLifecycle()
    const createRuntime = vi.fn().mockResolvedValue(runtime)
    renderHook(() => useBootstrap({ createRuntime, lifecycle }))
    await flush()

    await act(async () => {
      await lifecycle.callbacks?.onResume()
    })

    expect(runtime.health).toHaveBeenCalledOnce()
    expect(createRuntime).toHaveBeenCalledOnce()
  })

  it("disposes and reboots after resume health failure", async () => {
    const firstRuntime = runtimeFixture({
      health: vi.fn().mockRejectedValue(new Error("closed")),
    })
    const secondRuntime = runtimeFixture()
    const lifecycle = new FakeLifecycle()
    const createRuntime = vi
      .fn<() => Promise<MyFinRuntime>>()
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime)
    const { result } = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle })
    )
    await flush()

    await act(async () => {
      await lifecycle.callbacks?.onResume()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flush()

    expect(firstRuntime.dispose).toHaveBeenCalledOnce()
    expect(createRuntime).toHaveBeenCalledTimes(2)
    expect(result.current.state).toMatchObject({
      status: "READY",
      runtime: secondRuntime,
    })
  })

  it("maps resume health failures to the safe health code when reboot fails", async () => {
    const firstRuntime = runtimeFixture({
      health: vi.fn().mockRejectedValue(new Error("closed")),
    })
    const lifecycle = new FakeLifecycle()
    const createRuntime = vi
      .fn<() => Promise<MyFinRuntime>>()
      .mockResolvedValueOnce(firstRuntime)
      .mockRejectedValueOnce(new Error("reopen failed"))
    const { result } = renderHook(() =>
      useBootstrap({ createRuntime, lifecycle })
    )
    await flush()

    await act(async () => {
      await lifecycle.callbacks?.onResume()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flush()

    expect(result.current.state).toMatchObject({
      status: "FAILED",
      error: { code: "RUNTIME_COMPOSITION_FAILED" },
    })
  })

  it("unsubscribes lifecycle and disposes runtime on unmount", async () => {
    const runtime = runtimeFixture()
    const lifecycle = new FakeLifecycle()
    const { unmount } = renderHook(() =>
      useBootstrap({
        createRuntime: vi.fn().mockResolvedValue(runtime),
        lifecycle,
      })
    )
    await flush()

    unmount()
    await flush()

    expect(lifecycle.unsubscribe).toHaveBeenCalledOnce()
    expect(runtime.dispose).toHaveBeenCalledOnce()
  })

  it("closes the runtime once when the lifecycle requests close", async () => {
    const runtime = runtimeFixture()
    const lifecycle = new FakeLifecycle()
    const { unmount } = renderHook(() =>
      useBootstrap({
        createRuntime: vi.fn().mockResolvedValue(runtime),
        lifecycle,
      })
    )
    await flush()

    await act(async () => {
      await lifecycle.callbacks?.onCloseRequested()
    })
    unmount()
    await flush()

    expect(lifecycle.unsubscribe).toHaveBeenCalledOnce()
    expect(runtime.dispose).toHaveBeenCalledOnce()
  })

  it("disposes a runtime when lifecycle subscription fails", async () => {
    const runtime = runtimeFixture()
    const lifecycle: BootstrapLifecycle = {
      subscribe: vi.fn().mockRejectedValue(new Error("window unavailable")),
    }
    const { result } = renderHook(() =>
      useBootstrap({
        createRuntime: vi.fn().mockResolvedValue(runtime),
        lifecycle,
      })
    )
    await flush()

    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(result.current.state).toMatchObject({
      status: "FAILED",
      error: { code: "RUNTIME_COMPOSITION_FAILED" },
    })
  })

  it("does not health-check while STARTING or FAILED", async () => {
    const gate = deferred<MyFinRuntime>()
    const runtime = runtimeFixture()
    const lifecycle = new FakeLifecycle()
    const { result } = renderHook(() =>
      useBootstrap({ createRuntime: () => gate.promise, lifecycle })
    )

    expect(result.current.state.status).toBe("STARTING")
    expect(runtime.health).not.toHaveBeenCalled()
    gate.resolve(runtime)
    await flush()
    expect(result.current.state.status).toBe("READY")
  })
})
