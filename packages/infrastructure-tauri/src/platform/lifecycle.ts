import { getCurrentWindow } from "@tauri-apps/api/window"
import type { UnlistenFn } from "@tauri-apps/api/event"

export type TauriLifecycleCallbacks = {
  readonly onResume: () => void | Promise<void>
  readonly onCloseRequested: () => void | Promise<void>
}

export type TauriWindowEvents = {
  readonly onFocusChanged: (
    handler: (event: { readonly payload: boolean }) => void | Promise<void>
  ) => Promise<UnlistenFn>
  readonly onCloseRequested: (
    handler: () => void | Promise<void>
  ) => Promise<UnlistenFn>
}

export type TauriLifecycleOptions = {
  readonly window?: TauriWindowEvents
}

export class TauriLifecycle {
  private readonly window: TauriWindowEvents

  public constructor(options: TauriLifecycleOptions = {}) {
    this.window = options.window ?? getCurrentWindow()
  }

  public async subscribe(
    callbacks: TauriLifecycleCallbacks
  ): Promise<() => void> {
    const unlisteners: UnlistenFn[] = []

    try {
      unlisteners.push(
        await this.window.onFocusChanged(async ({ payload }) => {
          if (payload) {
            await callbacks.onResume()
          }
        })
      )
      unlisteners.push(
        await this.window.onCloseRequested(callbacks.onCloseRequested)
      )
    } catch (error: unknown) {
      for (const unlisten of unlisteners) {
        unlisten()
      }
      throw error
    }

    let active = true
    return () => {
      if (!active) {
        return
      }
      active = false
      for (const unlisten of unlisteners) {
        unlisten()
      }
    }
  }
}
