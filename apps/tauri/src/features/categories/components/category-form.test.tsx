/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "UNRESOLVED" },
  createIncome: vi.fn(),
  createExpense: vi.fn(),
  incomePending: false,
  expensePending: false,
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useCreateIncomeCategory: () => ({
    mutateAsync: state.createIncome,
    isPending: state.incomePending,
  }),
  useCreateExpenseCategory: () => ({
    mutateAsync: state.createExpense,
    isPending: state.expensePending,
  }),
}))

import { CategoryForm } from "./category-form"
import { categoryErrorMessage } from "./category-form-model"

describe("CategoryForm", () => {
  afterEach(() => {
    cleanup()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.createIncome.mockReset()
    state.createExpense.mockReset()
    state.incomePending = false
    state.expensePending = false
  })

  it("starts with the name field and Expense selected", () => {
    render(<CategoryForm />)

    expect(screen.getByLabelText("Nome da categoria")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Despesa" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Receita" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("validates the name before sending a command", async () => {
    render(<CategoryForm />)

    fireEvent.blur(screen.getByLabelText("Nome da categoria"))

    expect(
      await screen.findByText("Informe um nome para a categoria.")
    ).toBeTruthy()
    expect(state.createIncome).not.toHaveBeenCalled()
    expect(state.createExpense).not.toHaveBeenCalled()
  })

  it("submits a trimmed expense command scoped to the active book", async () => {
    state.createExpense.mockResolvedValue({ id: "expense-1" })
    render(<CategoryForm />)

    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "  Mercado  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    await waitFor(() => expect(state.createExpense).toHaveBeenCalledOnce())
    expect(state.createExpense).toHaveBeenCalledWith({
      bookId: "book-1",
      name: "Mercado",
      kind: "EXPENSE",
    })
    expect(state.createIncome).not.toHaveBeenCalled()
  })

  it("submits income when Receita is selected", async () => {
    state.createIncome.mockResolvedValue({ id: "income-1" })
    render(<CategoryForm />)

    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "Salário" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Receita" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    await waitFor(() =>
      expect(state.createIncome).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Salário",
        kind: "INCOME",
      })
    )
    expect(state.createExpense).not.toHaveBeenCalled()
  })

  it("keeps entered values and shows a safe error after failure", async () => {
    state.createExpense.mockRejectedValue(new Error("/private/vault.sqlite"))
    render(<CategoryForm />)

    const name = screen.getByLabelText("Nome da categoria") as HTMLInputElement
    fireEvent.change(name, { target: { value: "Moradia" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    expect(
      await screen.findByText(
        "Não foi possível criar a categoria. Tente novamente."
      )
    ).toBeTruthy()
    expect(name.value).toBe("Moradia")
    expect(screen.queryByText(/vault\.sqlite/)).toBeNull()
  })

  it("does not render the form without an active book", () => {
    state.session = { status: "UNRESOLVED" }
    render(<CategoryForm />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Selecione um livro"
    )
    expect(screen.queryByLabelText("Nome da categoria")).toBeNull()
  })

  it("maps known and unknown errors without exposing internals", () => {
    expect(categoryErrorMessage({ code: "DUPLICATE_ENTITY" })).toBe(
      "Já existe uma categoria com esse nome e tipo."
    )
    expect(categoryErrorMessage({ message: "secret path" })).not.toContain(
      "secret path"
    )
  })
})
