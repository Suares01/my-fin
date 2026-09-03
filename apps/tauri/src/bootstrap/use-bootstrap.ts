import { useCallback, useEffect, useRef, useState } from "react"
import {
  TauriLifecycle,
  type TauriLifecycleCallbacks,
} from "@workspace/infrastructure-tauri"
import {
  BootstrapError,
  createMyFinRuntime,
  type BootstrapErrorCode,
  type MyFinRuntime,
} from "../bootstrap/create-runtime.js"

export type BootstrapState =
  | { readonly status: "STARTING"; readonly attempt: number }
  | {
      readonly status: "READY"
      readonly attempt: number
      readonly runtime: MyFinRuntime
    }
  | {
      readonly status: "FAILED"
      readonly attempt: number
      readonly error: BootstrapError
    }

export type BootstrapLifecycle = {
  readonly subscribe: (
    callbacks: TauriLifecycleCallbacks
  ) => Promise<() => void>
}

export type UseBootstrapOptions = {
  readonly createRuntime?: () => Promise<MyFinRuntime>
  readonly lifecycle?: BootstrapLifecycle
}

export type BootstrapController = {
  readonly state: BootstrapState
  readonly retry: () => void
}

const initialState: BootstrapState = { status: "STARTING", attempt: 0 }

export function useBootstrap(
  options: UseBootstrapOptions = {}
): BootstrapController {
  const createRuntime = options.createRuntime ?? createMyFinRuntime
  const createRuntimeRef = useRef(createRuntime)
  const lifecycleRef = useRef<BootstrapLifecycle | null>(
    options.lifecycle ?? null
  )
  const [state, setState] = useState<BootstrapState>(initialState)
  const activeRef = useRef(false)
  const attemptRef = useRef(0)
  const pendingRef = useRef<Promise<void> | null>(null)
  const runtimeRef = useRef<MyFinRuntime | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const disposedRuntimesRef = useRef(new WeakSet<MyFinRuntime>())
  const startRef = useRef<(() => Promise<void>) | null>(null)

  const disposeRuntime = useCallback(async (runtime: MyFinRuntime) => {
    if (disposedRuntimesRef.current.has(runtime)) {
      return
    }
    disposedRuntimesRef.current.add(runtime)
    await runtime.dispose().catch(() => undefined)
  }, [])

  const detachLifecycle = useCallback(() => {
    const unsubscribe = unsubscribeRef.current
    unsubscribeRef.current = null
    unsubscribe?.()
  }, [])

  const disposeCurrent = useCallback(async () => {
    attemptRef.current += 1
    detachLifecycle()
    const runtime = runtimeRef.current
    runtimeRef.current = null
    if (runtime) {
      await disposeRuntime(runtime)
    }
  }, [detachLifecycle, disposeRuntime])

  const start = useCallback(async () => {
    if (!activeRef.current || pendingRef.current) {
      return
    }

    const attempt = ++attemptRef.current
    setState({ status: "STARTING", attempt })

    const run = (async () => {
      let runtime: MyFinRuntime | undefined
      try {
        runtime = await createRuntimeRef.current()
        if (!isCurrentAttempt(activeRef.current, attemptRef.current, attempt)) {
          await disposeRuntime(runtime)
          return
        }

        runtimeRef.current = runtime
        const callbacks: TauriLifecycleCallbacks = {
          onResume: async () => {
            if (
              !isCurrentAttempt(
                activeRef.current,
                attemptRef.current,
                attempt
              ) ||
              runtimeRef.current !== runtime
            ) {
              return
            }

            try {
              await runtime.health()
            } catch {
              detachLifecycle()
              runtimeRef.current = null
              await disposeRuntime(runtime)
              if (activeRef.current) {
                void startRef.current?.()
              }
            }
          },
          onCloseRequested: async () => {
            activeRef.current = false
            await disposeCurrent()
          },
        }
        const lifecycle = lifecycleRef.current ?? new TauriLifecycle()
        lifecycleRef.current = lifecycle
        const unsubscribe = await lifecycle.subscribe(callbacks)

        if (!isCurrentAttempt(activeRef.current, attemptRef.current, attempt)) {
          unsubscribe()
          await disposeRuntime(runtime)
          return
        }

        unsubscribeRef.current = unsubscribe
        setState({ status: "READY", attempt, runtime })
      } catch (error: unknown) {
        if (runtime) {
          await disposeRuntime(runtime)
        }
        if (!isCurrentAttempt(activeRef.current, attemptRef.current, attempt)) {
          return
        }
        setState({
          status: "FAILED",
          attempt,
          error: toBootstrapError(error, "RUNTIME_COMPOSITION_FAILED"),
        })
      }
    })()

    pendingRef.current = run
    await run
    if (pendingRef.current === run) {
      pendingRef.current = null
    }
  }, [detachLifecycle, disposeCurrent, disposeRuntime])

  useEffect(() => {
    startRef.current = start
  }, [start])

  useEffect(() => {
    activeRef.current = true
    void start()

    return () => {
      activeRef.current = false
      void disposeCurrent()
    }
  }, [disposeCurrent, start])

  return {
    state,
    retry: () => {
      if (state.status === "FAILED") {
        void start()
      }
    },
  }
}

export function toBootstrapError(
  error: unknown,
  fallbackCode: BootstrapErrorCode
): BootstrapError {
  if (error instanceof BootstrapError) {
    return error
  }

  return new BootstrapError(fallbackCode, "bootstrap-runtime")
}

function isCurrentAttempt(
  active: boolean,
  currentAttempt: number,
  attempt: number
): boolean {
  return active && currentAttempt === attempt
}
