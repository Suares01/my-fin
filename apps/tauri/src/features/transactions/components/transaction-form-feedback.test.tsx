/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ComponentProps } from "react"
import {
  TransactionFormAvailability,
  TransactionRefreshWarning,
} from "./transaction-form-feedback"

afterEach(cleanup)
type Options = ComponentProps<typeof TransactionFormAvailability>["options"]
const base: Options = {
  loading: false,
  error: null,
  bookId: "book-1",
  baseCurrency: "BRL",
  accounts: [{ id: "a1", name: "Conta" }],
  categories: [{ id: "c1", name: "Categoria" }],
  missingAccounts: false,
  missingCategories: false,
  requiresTwoAccounts: false,
  refresh: async () => {},
}
function feedback(
  options: Partial<Options> = {},
  unsafeAmount = false,
  onCancel = vi.fn()
) {
  return (
    <TransactionFormAvailability
      options={{ ...base, ...options }}
      unsafeAmount={unsafeAmount}
      onCancel={onCancel}
    >
      <input aria-label="Valor" />
    </TransactionFormAvailability>
  )
}

describe("TransactionFormAvailability", () => {
  it.each([
    [
      { error: new Error("offline") },
      false,
      "Não foi possível carregar as opções",
    ],
    [{ bookId: null }, false, "Selecione um livro antes de continuar"],
    [
      { baseCurrency: undefined },
      false,
      "Selecione um livro antes de continuar",
    ],
    [{}, true, "Valor acima do limite seguro do formulário"],
    [
      { requiresTwoAccounts: true },
      false,
      "Crie pelo menos duas contas para transferir",
    ],
    [{ missingAccounts: true }, false, "Crie uma conta antes de continuar"],
    [
      { missingCategories: true },
      false,
      "Crie uma categoria antes de continuar",
    ],
  ] as const)("blocks fields for %j", (options, unsafeAmount, title) => {
    render(feedback(options, unsafeAmount))
    expect(screen.getByRole("alert").getAttribute("data-slot")).toBe(
      "error-state"
    )
    expect(screen.getByRole("heading").textContent).toBe(title)
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("preserves priority when several conditions coexist", () => {
    const options: Partial<Options> = {
      loading: true,
      error: new Error("offline"),
      bookId: null,
      requiresTwoAccounts: true,
      missingAccounts: true,
      missingCategories: true,
    }
    const { rerender } = render(feedback(options, true))
    expect(screen.getByRole("status").textContent).toBe(
      "Carregando opções da transação…"
    )
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    options.loading = false
    rerender(feedback(options, true))
    expect(screen.getByRole("heading").textContent).toBe(
      "Não foi possível carregar as opções"
    )
    options.error = null
    rerender(feedback(options, true))
    expect(screen.getByRole("heading").textContent).toBe(
      "Selecione um livro antes de continuar"
    )
    expect(screen.queryByRole("button")).toBeNull()
    options.bookId = "book-1"
    rerender(feedback(options, true))
    expect(screen.getByRole("heading").textContent).toBe(
      "Valor acima do limite seguro do formulário"
    )
    rerender(feedback(options))
    expect(screen.getByRole("heading").textContent).toBe(
      "Crie pelo menos duas contas para transferir"
    )
    options.requiresTwoAccounts = false
    rerender(feedback(options))
    expect(screen.getByRole("heading").textContent).toBe(
      "Crie uma conta antes de continuar"
    )
    options.missingAccounts = false
    rerender(feedback(options))
    expect(screen.getByRole("heading").textContent).toBe(
      "Crie uma categoria antes de continuar"
    )
    options.missingCategories = false
    rerender(feedback(options))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("textbox", { name: "Valor" })).toBeTruthy()
  })

  it("retries loading and restores the fields when options recover", () => {
    const refresh = vi.fn(async () => {})
    const { rerender } = render(
      feedback({ error: new Error("offline"), refresh })
    )
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.queryByRole("textbox")).toBeNull()
    rerender(feedback({ refresh }))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("textbox", { name: "Valor" })).toBeTruthy()
  })

  it("explains the exact unsafe limit and closes through onCancel", () => {
    const cancel = vi.fn()
    render(feedback({}, true, cancel))
    expect(
      screen.getByText(
        "Esta transação não pode ser editada neste formulário, pois seu valor excede 9007199254740991 centavos."
      )
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }))
    expect(cancel).toHaveBeenCalledOnce()
  })

  it.each([
    [{ requiresTwoAccounts: true }, "Criar conta", "/accounts"],
    [{ missingAccounts: true }, "Criar conta", "/accounts"],
    [{ missingCategories: true }, "Criar categoria", "/categories"],
  ] as const)("retains navigation for %j", (options, label, href) => {
    render(feedback(options))
    expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(
      href
    )
  })

  it("retains the saved-transaction warning as an inline Alert", () => {
    render(<TransactionRefreshWarning />)
    expect(screen.getByRole("alert").getAttribute("data-slot")).toBe("alert")
    expect(screen.getByText("Transação salva")).toBeTruthy()
    expect(
      screen.getByText("Atualize os dados para ver todas as projeções.")
    ).toBeTruthy()
  })
})
