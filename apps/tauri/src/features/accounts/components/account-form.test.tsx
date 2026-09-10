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
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as unknown,
  toastAdd: vi.fn(),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useCreateAccount: () => ({
    mutateAsync: state.mutateAsync,
    isPending: state.isPending,
    isError: state.error !== null,
    error: state.error,
  }),
}))

vi.mock("@workspace/ui/components/toast", () => ({
  toast: { add: state.toastAdd },
}))

import { AccountForm } from "./account-form"
import { accountErrorMessage } from "./account-form-model"

describe("AccountForm", () => {
  afterEach(() => {
    cleanup()
    state.session = { status: "ACTIVE", bookId: "book-1" }
    state.mutateAsync.mockReset()
    state.isPending = false
    state.error = null
    state.toastAdd.mockReset()
  })

  it("starts with the name field and Asset selected", () => {
    render(<AccountForm />)

    expect(screen.getByLabelText("Nome da conta")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Ativo" }).getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Passivo" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("validates the name through the resolver before sending a command", async () => {
    render(<AccountForm />)

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    expect(
      await screen.findByText("Informe um nome para a conta.")
    ).toBeTruthy()
    expect(state.mutateAsync).not.toHaveBeenCalled()
  })

  it("requires a selected account kind before sending a command", async () => {
    render(<AccountForm />)

    fireEvent.click(screen.getByRole("button", { name: "Ativo" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    expect(await screen.findByText("Escolha Ativo ou Passivo.")).toBeTruthy()
    expect(state.mutateAsync).not.toHaveBeenCalled()
  })

  it("submits a trimmed command scoped to the active book", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(<AccountForm />)

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "  Carteira  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce())
    expect(state.mutateAsync).toHaveBeenCalledWith({
      bookId: "book-1",
      name: "Carteira",
      kind: "ASSET",
    })
  })

  it("submits Liability when Passivo is selected", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    render(<AccountForm />)

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Cartão" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Passivo" }))
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        bookId: "book-1",
        name: "Cartão",
        kind: "LIABILITY",
      })
    )
  })

  it("keeps entered values and shows a safe toast after failure", async () => {
    state.mutateAsync.mockRejectedValue(new Error("/private/vault.sqlite"))
    render(<AccountForm />)

    const name = screen.getByLabelText("Nome da conta") as HTMLInputElement
    fireEvent.change(name, { target: { value: "Reserva" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))

    await waitFor(() => expect(state.toastAdd).toHaveBeenCalledOnce())
    expect(state.toastAdd).toHaveBeenCalledWith({
      type: "error",
      title: "Não foi possível criar a conta",
      description: "Não foi possível criar a conta. Tente novamente.",
    })
    expect(name.value).toBe("Reserva")
    expect(screen.queryByText(/vault\.sqlite/)).toBeNull()
  })

  it("blocks controls while creating", () => {
    state.isPending = true
    render(<AccountForm onCancel={vi.fn()} />)

    expect(
      screen.getByLabelText("Nome da conta").hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Ativo" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Passivo" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(
      screen.getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Criando conta" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("does not render the form without an active book", () => {
    state.session = { status: "UNRESOLVED" }
    render(<AccountForm />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Selecione um livro"
    )
    expect(screen.queryByLabelText("Nome da conta")).toBeNull()
  })

  it("maps known and unknown errors without exposing internals", () => {
    expect(accountErrorMessage({ code: "DUPLICATE_ENTITY" })).toBe(
      "Já existe uma conta com esse nome e tipo."
    )
    expect(accountErrorMessage({ message: "secret path" })).not.toContain(
      "secret path"
    )
  })
})
