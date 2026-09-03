/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = vi.hoisted((): any => ({ options: null }))
vi.mock("../hooks/use-transaction-form-options.js", () => ({
  useTransactionFormOptions: () => state.options,
}))
import { ExpenseForm } from "./expense-form.js"
const base = {
  bookId: "book-1",
  baseCurrency: "BRL",
  accounts: [{ id: "a1", name: "Carteira" }],
  categories: [{ id: "c1", name: "Mercado" }],
  loading: false,
  error: null,
  missingAccounts: false,
  missingCategories: false,
  refresh: vi.fn(),
}
function renderForm(
  overrides: Partial<React.ComponentProps<typeof ExpenseForm>> = {}
) {
  const props = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<ExpenseForm {...props} />) }
}
function fill() {
  fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "a1" } })
  fireEvent.change(screen.getByLabelText("Categoria"), {
    target: { value: "c1" },
  })
  fireEvent.change(screen.getByLabelText("Valor"), {
    target: { value: "10,00" },
  })
  fireEvent.change(screen.getByLabelText("Data"), {
    target: { value: "2026-09-03" },
  })
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Mercado" },
  })
}
beforeEach(() => {
  state.options = { ...base, refresh: vi.fn() }
})
afterEach(cleanup)
describe("ExpenseForm", () => {
  it("emits exactly the validated expense draft", async () => {
    const { props } = renderForm()
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar despesa" }))
    await waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        type: "EXPENSE",
        accountId: "a1",
        categoryId: "c1",
        amountMinor: "1000",
        currency: "BRL",
        occurredOn: "2026-09-03",
        description: "Mercado",
      })
    )
  })
  it("prefills the edit draft", () => {
    renderForm({
      initialDraft: {
        type: "EXPENSE",
        accountId: "a1",
        categoryId: "c1",
        amountMinor: "1000",
        currency: "BRL",
        occurredOn: "2026-09-03",
        description: "Antes",
      },
    })
    expect(screen.getByLabelText("Descrição").getAttribute("value")).toBe(
      "Antes"
    )
  })
  it("shows account guidance when accounts are missing", () => {
    state.options = { ...base, accounts: [], missingAccounts: true }
    renderForm()
    expect(
      screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")
    ).toBe("/accounts")
  })
  it("shows category guidance when categories are missing", () => {
    state.options = { ...base, categories: [], missingCategories: true }
    renderForm()
    expect(
      screen.getByRole("link", { name: "Criar categoria" }).getAttribute("href")
    ).toBe("/categories")
  })
  it("renders renamed expense options", () => {
    state.options = {
      ...base,
      categories: [{ id: "c1", name: "Mercado renomeado" }],
    }
    renderForm()
    expect(
      screen.getByRole("option", { name: "Mercado renomeado" })
    ).toBeTruthy()
  })
  it("shows field validation without submitting", async () => {
    const { props } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Salvar despesa" }))
    expect(
      await screen.findByText("Informe um valor inteiro positivo.")
    ).toBeTruthy()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
  it("retains values after service failure", async () => {
    const { props } = renderForm({
      onSubmit: vi.fn().mockRejectedValue(new Error("offline")),
    })
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar despesa" }))
    expect(
      await screen.findByText("Não foi possível salvar a transação")
    ).toBeTruthy()
    expect(screen.getByLabelText("Descrição").getAttribute("value")).toBe(
      "Mercado"
    )
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
  it("disables the submit control while pending", () => {
    renderForm({ pending: true })
    expect(
      screen
        .getByRole("button", { name: "Salvando despesa" })
        .hasAttribute("disabled")
    ).toBe(true)
  })
  it("shows a refresh warning", () => {
    renderForm({ refreshWarning: true })
    expect(
      screen.getByText("Atualize os dados para ver todas as projeções.")
    ).toBeTruthy()
  })
  it("locks after an optimistic conflict", async () => {
    const conflict = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const { props } = renderForm({
      onSubmit: vi.fn().mockRejectedValue(conflict),
    })
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar despesa" }))
    expect(await screen.findByText("Este lançamento mudou")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Salvar despesa" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
  it("shows loading options explicitly", () => {
    state.options = { ...base, loading: true }
    renderForm()
    expect(screen.getByText("Carregando opções da transação…")).toBeTruthy()
  })
  it("retries a failed option load", () => {
    state.options = { ...base, error: new Error("offline") }
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(state.options.refresh).toHaveBeenCalledOnce()
  })
})
