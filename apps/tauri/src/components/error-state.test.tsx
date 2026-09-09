/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ErrorState,
  type ErrorStateProps,
} from "@workspace/ui/components/error-state"

const preferences = vi.hoisted(() => ({ reducedMotion: false }))
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => preferences.reducedMotion,
}))

afterEach(() => {
  cleanup()
  preferences.reducedMotion = false
})

describe("ErrorState", () => {
  it.each([
    "generic",
    "load-error",
    "book-required",
    "amount-limit",
    "transfer-accounts-required",
    "accounts-required",
    "categories-required",
  ] as const)(
    "immediately shows the final %s state with reduced motion",
    (variant) => {
      preferences.reducedMotion = true
      render(
        <ErrorState
          variant={variant}
          actionLabel="Fechar"
          onAction={() => {}}
        />
      )
      const alert = screen.getByRole("alert")
      expect(alert.style.opacity).toBe("1")
      expect(alert.style.transform).toBe("none")
      expect(screen.getByRole("heading").style.opacity).toBe("1")
      expect(
        document.getElementById(alert.getAttribute("aria-describedby")!)?.style
          .opacity
      ).toBe("1")
      expect(screen.getByRole("button").parentElement?.style.opacity).toBe("1")
      expect(alert.querySelector("svg g")?.getAttribute("style")).toContain(
        "transform: none"
      )
      expect(
        alert.querySelector<SVGPathElement>("svg path")?.style.opacity
      ).toBe("1")
      expect(
        alert.querySelector("svg path")?.getAttribute("stroke-dasharray")
      ).toBe("1 1")
    }
  )

  it.each([
    ["generic", "Não foi possível continuar"],
    ["load-error", "Não foi possível carregar os dados"],
    ["book-required", "Selecione um livro antes de continuar"],
    ["amount-limit", "Valor acima do limite seguro do formulário"],
    [
      "transfer-accounts-required",
      "Crie pelo menos duas contas para transferir",
    ],
    ["accounts-required", "Crie uma conta antes de continuar"],
    ["categories-required", "Crie uma categoria antes de continuar"],
  ] as const)("renders accessible %s feedback", (variant, title) => {
    render(<ErrorState variant={variant} />)
    const alert = screen.getByRole("alert")
    expect(screen.getByRole("heading", { name: title }).id).toBe(
      alert.getAttribute("aria-labelledby")
    )
    expect(
      document
        .getElementById(alert.getAttribute("aria-describedby")!)
        ?.textContent?.trim()
    ).toBeTruthy()
    expect(alert.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
    expect(alert.querySelector("svg")?.getAttribute("focusable")).toBe("false")
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("defaults to generic and accepts custom copy and layout", () => {
    const { rerender } = render(<ErrorState />)
    expect(screen.getByRole("heading").textContent).toBe(
      "Não foi possível continuar"
    )
    rerender(
      <ErrorState
        title="Erro específico"
        description="Uma orientação específica."
        className="w-full"
      />
    )
    expect(screen.getByRole("heading").textContent).toBe("Erro específico")
    expect(screen.getByText("Uma orientação específica.")).toBeTruthy()
    expect(screen.getByRole("alert").classList.contains("w-full")).toBe(true)
  })

  it("calls the action without submitting a parent form or taking focus", () => {
    const action = vi.fn()
    const submit = vi.fn((event) => event.preventDefault())
    const { rerender } = render(
      <form onSubmit={submit}>
        <input aria-label="Anterior" />
      </form>
    )
    screen.getByRole("textbox").focus()
    rerender(
      <form onSubmit={submit}>
        <input aria-label="Anterior" />
        <ErrorState actionLabel="Repetir" onAction={action} />
      </form>
    )
    expect(document.activeElement).toBe(screen.getByRole("textbox"))
    const button = screen.getByRole("button", { name: "Repetir" })
    expect(button.getAttribute("type")).toBe("button")
    fireEvent.click(button)
    expect(action).toHaveBeenCalledOnce()
    expect(submit).not.toHaveBeenCalled()
  })

  it("renders navigation as an actual link", () => {
    render(<ErrorState actionLabel="Criar conta" actionHref="/accounts" />)
    const link = screen.getByRole("link", { name: "Criar conta" })
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/accounts")
    expect(screen.queryByRole("button")).toBeNull()
  })
})

// Compile-time coverage of the public action contract (checked by tsc).
const actionContracts: ErrorStateProps[] = [
  {},
  { actionLabel: "Repetir", onAction: () => {} },
  { actionLabel: "Contas", actionHref: "/accounts" },
  // @ts-expect-error A callback requires a label.
  { onAction: () => {} },
  // @ts-expect-error A link requires a label.
  { actionHref: "/accounts" },
  // @ts-expect-error A label requires an action.
  { actionLabel: "Repetir" },
  // @ts-expect-error Callback and navigation are mutually exclusive.
  { actionLabel: "Repetir", onAction: () => {}, actionHref: "/accounts" },
]
void actionContracts
