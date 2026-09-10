/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as
    | { readonly status: "ACTIVE"; readonly bookId: string }
    | { readonly status: "UNRESOLVED" },
  createIncome: vi.fn(),
  createExpense: vi.fn(),
  update: vi.fn(),
  incomePending: false,
  expensePending: false,
  updatePending: false,
  toastAdd: vi.fn(),
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
  useUpdateCategory: () => ({
    mutateAsync: state.update,
    isPending: state.updatePending,
  }),
}))

vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toastAdd },
}))

import { CategoryForm } from "./category-form"
import { categoryErrorMessage } from "./category-form-model"

describe("CategoryForm", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.createIncome.mockReset()
    state.createExpense.mockReset()
    state.update.mockReset()
    state.toastAdd.mockReset()
    state.incomePending = false
    state.expensePending = false
    state.updatePending = false
  })

  it("starts with the name field and Expense selected", () => {
    render(<CategoryForm />)

    expect(screen.getByLabelText("Nome da categoria")).toBeTruthy()
    expect(
      (screen.getByLabelText("Cor da categoria") as HTMLInputElement).value
    ).toBe("f43f5e")
    fireEvent.click(screen.getByRole("button", { name: "Ícone da categoria" }))
    expect(
      screen
        .getByRole("radio", { name: "Ícone label-dollar" })
        .getAttribute("aria-checked")
    ).toBe("true")
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

    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

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
      iconKey: "label-dollar",
      colorHex: "f43f5e",
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
        iconKey: "label-dollar",
        colorHex: "f43f5e",
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

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível criar a categoria",
      description: "Não foi possível criar a categoria. Tente novamente.",
    })
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

  it("submits normalized visual values from the create form", async () => {
    state.createExpense.mockResolvedValue({ id: "expense-2" })
    render(<CategoryForm />)

    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "  Lazer  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Ícone da categoria" }))
    fireEvent.click(screen.getByRole("radio", { name: "Ícone home" }))
    fireEvent.change(screen.getByLabelText("Cor da categoria"), {
      target: { value: "ABCDEF" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    await waitFor(() =>
      expect(state.createExpense).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Lazer",
        kind: "EXPENSE",
        iconKey: "home",
        colorHex: "abcdef",
      })
    )
  })

  it("prefills edit mode and exposes kind as immutable information", () => {
    render(
      <CategoryForm
        mode="edit"
        initialCategory={{
          id: "category-1",
          name: "Mercado",
          kind: "EXPENSE",
          status: "ACTIVE",
          iconKey: "cart",
          colorHex: "abcdef",
          version: 4,
        }}
      />
    )

    expect(
      (screen.getByLabelText("Nome da categoria") as HTMLInputElement).value
    ).toBe("Mercado")
    expect(
      (screen.getByLabelText("Cor da categoria") as HTMLInputElement).value
    ).toBe("abcdef")
    fireEvent.click(screen.getByRole("button", { name: "Ícone da categoria" }))
    expect(
      screen
        .getByRole("radio", { name: "Ícone cart" })
        .getAttribute("aria-checked")
    ).toBe("true")
    expect(screen.queryByRole("button", { name: "Despesa" })).toBeNull()
    expect(screen.getByText("Despesa")).toBeTruthy()
  })

  it("submits one update command with the loaded version", async () => {
    state.update.mockResolvedValue({ id: "category-1" })
    render(
      <CategoryForm
        mode="edit"
        initialCategory={{
          id: "category-1",
          name: "Mercado",
          kind: "EXPENSE",
          status: "ACTIVE",
          iconKey: "cart",
          colorHex: "abcdef",
          version: 4,
        }}
      />
    )

    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "  Supermercado " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }))

    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        bookId: "book-1",
        categoryId: "category-1",
        expectedVersion: 4,
        name: "Supermercado",
        iconKey: "cart",
        colorHex: "abcdef",
      })
    )
  })

  it("blocks a create mutation when the color is invalid", async () => {
    render(<CategoryForm />)
    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "Moradia" },
    })
    fireEvent.change(screen.getByLabelText("Cor da categoria"), {
      target: { value: "#abc" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    expect(
      await screen.findByText(
        "Informe uma cor hexadecimal opaca de seis dígitos."
      )
    ).toBeTruthy()
    expect(state.createExpense).not.toHaveBeenCalled()
  })

  it("blocks a create mutation when the name is empty", async () => {
    render(<CategoryForm />)
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))

    expect(
      await screen.findByText("Informe um nome para a categoria.")
    ).toBeTruthy()
    expect(state.createExpense).not.toHaveBeenCalled()
  })

  it("prevents a second submit while the create mutation is pending", async () => {
    state.createExpense.mockImplementation(() => new Promise(() => undefined))
    render(<CategoryForm />)

    fireEvent.change(screen.getByLabelText("Nome da categoria"), {
      target: { value: "Moradia" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }))
    fireEvent.click(screen.getByRole("button", { name: "Criando categoria" }))

    await waitFor(() => expect(state.createExpense).toHaveBeenCalledOnce())
    expect(screen.getByLabelText("Nome da categoria")).toHaveProperty(
      "disabled",
      true
    )
  })

  it("locks edit resubmission after a version conflict", async () => {
    state.update.mockRejectedValue({ code: "OPTIMISTIC_CONCURRENCY_FAILURE" })
    render(
      <CategoryForm
        mode="edit"
        initialCategory={{
          id: "category-1",
          name: "Mercado",
          kind: "EXPENSE",
          status: "ACTIVE",
          iconKey: "cart",
          colorHex: "abcdef",
          version: 4,
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }))
    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    const submitButton = screen.getByRole("button", {
      name: "Salvando categoria",
    })
    expect(submitButton).toHaveProperty("disabled", true)

    expect(state.update).toHaveBeenCalledOnce()
    expect(screen.getByLabelText("Nome da categoria")).toHaveProperty(
      "disabled",
      true
    )
  })

  it("calls the explicit cancel action without submitting", () => {
    const onCancel = vi.fn()
    render(<CategoryForm onCancel={onCancel} />)

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(state.createExpense).not.toHaveBeenCalled()
  })

  it("keeps edit values and uses a safe toast after a mutation failure", async () => {
    state.update.mockRejectedValue(new Error("/private/vault.sqlite"))
    render(
      <CategoryForm
        mode="edit"
        initialCategory={{
          id: "category-1",
          name: "Mercado",
          kind: "EXPENSE",
          status: "ACTIVE",
          iconKey: "cart",
          colorHex: "abcdef",
          version: 4,
        }}
      />
    )

    const name = screen.getByLabelText("Nome da categoria") as HTMLInputElement
    fireEvent.change(name, { target: { value: "Supermercado" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }))

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(name.value).toBe("Supermercado")
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível editar a categoria",
      description: "Não foi possível editar a categoria. Tente novamente.",
    })
  })
})
