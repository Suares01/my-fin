// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TauriLifecycleCallbacks } from "@workspace/infrastructure-tauri"
import {
  BootstrapFailureScreen,
  BootstrapRoot,
  BootstrapStartingScreen,
} from "./bootstrap-root.js"
import {
  BootstrapError,
  type MyFinRuntime,
} from "../bootstrap/create-runtime.js"
import { useMyFin } from "../providers/index.js"
import type { MyFinServices } from "../bootstrap/create-services.js"
import type { BootstrapLifecycle } from "./use-bootstrap.js"

class FakeLifecycle implements BootstrapLifecycle {
  public callbacks: TauriLifecycleCallbacks | null = null

  public readonly subscribe = vi.fn(
    async (callbacks: TauriLifecycleCallbacks) => {
      this.callbacks = callbacks
      return vi.fn()
    }
  )
}

function runtimeFixture(): MyFinRuntime {
  return {
    services: {} as MyFinServices,
    health: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("bootstrap startup and recovery screens", () => {
  it("communicates the startup action in Portuguese", () => {
    render(<BootstrapStartingScreen attempt={1} />)

    expect(
      screen.getByRole("heading", { name: "Preparando seu cofre…" })
    ).toBeTruthy()
    expect(screen.getByText(/Verificação em andamento/)).toBeTruthy()
    expect(
      screen.getByRole("status", { name: "Estado da preparação" })
    ).toBeTruthy()
  })

  it("marks startup as busy and labels the page for assistive technology", () => {
    render(<BootstrapStartingScreen attempt={2} />)

    expect(
      screen.getByRole("main").getAttribute("aria-labelledby")
    ).toBeTruthy()
    const status = screen.getByRole("status", { name: "Estado da preparação" })
    expect(status.getAttribute("aria-busy")).toBe("true")
    expect(
      status.querySelector('[data-slot="spinner"]')?.getAttribute("aria-hidden")
    ).toBe("true")
    expect(screen.getByText(/tentativa 2/)).toBeTruthy()
  })

  it("explains recovery without exposing SQL or filesystem paths", () => {
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("MIGRATION_FAILED", "diag-42")}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/Feche outras instâncias/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/SQL|sqlite|path|caminho/i)
  })

  it("exposes a labelled diagnostic code and an actionable retry", () => {
    const onRetry = vi.fn()
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("VAULT_OPEN_FAILED", "vault-abc")}
        onRetry={onRetry}
      />
    )

    expect(screen.getByLabelText("Código diagnóstico").textContent).toBe(
      "vault-abc"
    )
    const retry = screen.getByRole("button", {
      name: "Tentar preparar novamente",
    })
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("prevents duplicate retry gestures and shows loading feedback", () => {
    const onRetry = vi.fn()
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("RUNTIME_COMPOSITION_FAILED", "compose-7")}
        onRetry={onRetry}
      />
    )

    const retry = screen.getByRole("button", {
      name: "Tentar preparar novamente",
    })
    fireEvent.click(retry)

    expect(retry.hasAttribute("disabled")).toBe(true)
    expect(
      screen.getByRole("button", { name: "Tentando novamente…" })
    ).toBeTruthy()
    expect(retry.getAttribute("aria-busy")).toBe("true")
    expect(
      retry.querySelector('[data-slot="spinner"]')?.getAttribute("aria-hidden")
    ).toBe("true")
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("copies the safe diagnostic and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("MIGRATION_FAILED", "copy-9")}
        onRetry={vi.fn()}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar código diagnóstico" })
    )
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Resultado da cópia" }).textContent
      ).toContain("Código copiado.")
    )
    expect(writeText).toHaveBeenCalledWith("copy-9")
  })

  it("announces a recoverable copy failure without leaking internals", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied /tmp/sqlite")),
      },
    })
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("MIGRATION_FAILED", "copy-failed")}
        onRetry={vi.fn()}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar código diagnóstico" })
    )
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Resultado da cópia" }).textContent
      ).toContain("Não foi possível copiar.")
    )
    expect(document.body.textContent).not.toContain("/tmp/sqlite")
  })

  it("keeps the recovery action keyboard reachable with a touch target", () => {
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("VAULT_OPEN_FAILED", "keyboard-1")}
        onRetry={vi.fn()}
      />
    )

    const copy = screen.getByRole("button", {
      name: "Copiar código diagnóstico",
    })
    copy.focus()
    expect(document.activeElement).toBe(copy)
    expect(copy.className).toContain("touch-target")
  })

  it("does not mount children while STARTING", () => {
    const gate = deferred<MyFinRuntime>()
    render(
      <BootstrapRoot
        bootstrapOptions={{
          createRuntime: () => gate.promise,
          lifecycle: new FakeLifecycle(),
        }}
      >
        <ReadyProbe />
      </BootstrapRoot>
    )

    expect(screen.queryByText("runtime-ready")).toBeNull()
    expect(
      screen.getByRole("heading", { name: "Preparando seu cofre…" })
    ).toBeTruthy()
    gate.resolve(runtimeFixture())
  })

  it("does not mount children while FAILED", async () => {
    render(
      <BootstrapRoot
        bootstrapOptions={{
          createRuntime: vi
            .fn()
            .mockRejectedValue(
              new BootstrapError("MIGRATION_FAILED", "failed-screen")
            ),
          lifecycle: new FakeLifecycle(),
        }}
      >
        <ReadyProbe />
      </BootstrapRoot>
    )

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Seu cofre precisa de atenção" })
      ).toBeTruthy()
    )
    expect(screen.queryByText("runtime-ready")).toBeNull()
  })

  it("mounts providers and children only after READY", async () => {
    const runtime = runtimeFixture()
    render(
      <BootstrapRoot
        bootstrapOptions={{
          createRuntime: vi.fn().mockResolvedValue(runtime),
          lifecycle: new FakeLifecycle(),
        }}
      >
        <ReadyProbe />
      </BootstrapRoot>
    )

    await waitFor(() => expect(screen.getByText("runtime-ready")).toBeTruthy())
  })

  it("keeps the visual root responsive and reduced-motion compatible", () => {
    const { container } = render(<BootstrapStartingScreen attempt={1} />)
    const main = screen.getByRole("main")

    expect(main.className).toContain("safe-area-bottom")
    expect(main.className).toContain("overflow-x-clip")
    expect(container.querySelector(".motion-reveal")).toBeTruthy()
    expect(
      Array.from(container.querySelectorAll("div")).some((element) =>
        element.className.includes("lg:grid-cols-")
      )
    ).toBe(true)
  })

  it("keeps startup feedback in one named live status region", () => {
    render(<BootstrapStartingScreen attempt={1} />)

    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(
      screen
        .getByRole("status", { name: "Estado da preparação" })
        .getAttribute("aria-live")
    ).toBe("polite")
  })

  it("wraps diagnostic content and keeps recovery controls reachable on compact layouts", () => {
    const { container } = render(
      <BootstrapFailureScreen
        error={
          new BootstrapError(
            "MIGRATION_FAILED",
            "diagnostic-with-a-long-safe-id"
          )
        }
        onRetry={vi.fn()}
      />
    )

    expect(container.querySelector('[data-slot="code"]')?.className).toContain(
      "break-all"
    )
    expect(
      screen.getByRole("button", { name: "Copiar código diagnóstico" })
        .className
    ).toContain("w-full")
    expect(
      screen.getByRole("button", { name: "Tentar preparar novamente" })
        .className
    ).toContain("w-full")
  })

  it("associates the failure alert with its title and recovery copy", () => {
    render(
      <BootstrapFailureScreen
        error={new BootstrapError("MIGRATION_FAILED", "aria-4")}
        onRetry={vi.fn()}
      />
    )
    const alert = screen.getByRole("alert")
    const titleId = alert.getAttribute("aria-labelledby")
    const descriptionId = alert.getAttribute("aria-describedby")

    expect(titleId && document.getElementById(titleId)?.textContent).toContain(
      "Não foi possível preparar o cofre"
    )
    expect(
      descriptionId && document.getElementById(descriptionId)?.textContent
    ).toContain("tente novamente")
  })
})

function ReadyProbe() {
  useMyFin()
  return <span>runtime-ready</span>
}
