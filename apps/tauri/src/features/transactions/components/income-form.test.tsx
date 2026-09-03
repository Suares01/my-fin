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
import { IncomeForm } from "./income-form.js"

const base = {
  bookId: "book-1",
  baseCurrency: "BRL",
  accounts: [{ id: "a1", name: "Carteira" }],
  categories: [{ id: "c1", name: "Salário" }],
  loading: false,
  error: null,
  missingAccounts: false,
  missingCategories: false,
  refresh: vi.fn(),
}
function renderForm(
  overrides: Partial<React.ComponentProps<typeof IncomeForm>> = {}
) {
  const props = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<IncomeForm {...props} />) }
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
    target: { value: "Salário" },
  })
}
beforeEach(() => {
  state.options = { ...base, refresh: vi.fn() }
})
afterEach(cleanup)
describe("IncomeForm", () => {
  it("emits exactly the validated income draft", async () => {
    const { props } = renderForm()
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))
    await waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        type: "INCOME",
        accountId: "a1",
        categoryId: "c1",
        amountMinor: "1000",
        currency: "BRL",
        occurredOn: "2026-09-03",
        description: "Salário",
      })
    )
  })
  it("prefills the edit draft", () => {
    renderForm({
      initialDraft: {
        type: "INCOME",
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
  it("shows account creation guidance when accounts are missing", () => {
    state.options = { ...base, accounts: [], missingAccounts: true }
    renderForm()
    expect(
      screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")
    ).toBe("/accounts")
  })
  it("shows category creation guidance when categories are missing", () => {
    state.options = { ...base, categories: [], missingCategories: true }
    renderForm()
    expect(
      screen.getByRole("link", { name: "Criar categoria" }).getAttribute("href")
    ).toBe("/categories")
  })
  it("renders renamed options from the current read model", () => {
    state.options = {
      ...base,
      accounts: [{ id: "a1", name: "Conta renomeada" }],
    }
    renderForm()
    expect(screen.getByRole("option", { name: "Conta renomeada" })).toBeTruthy()
  })
  it("shows field validation without sending a draft", async () => {
    const { props } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))
    expect(
      await screen.findByText("Informe um valor inteiro positivo.")
    ).toBeTruthy()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
  it("keeps values and reports a service failure", async () => {
    const { props } = renderForm({
      onSubmit: vi.fn().mockRejectedValue(new Error("offline")),
    })
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))
    expect(
      await screen.findByText("Não foi possível salvar a transação")
    ).toBeTruthy()
    expect(screen.getByLabelText("Descrição").getAttribute("value")).toBe(
      "Salário"
    )
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
  it("disables submission while pending", () => {
    renderForm({ pending: true })
    expect(
      screen
        .getByRole("button", { name: "Salvando receita" })
        .hasAttribute("disabled")
    ).toBe(true)
  })
  it("shows the refresh warning after a successful mutation refresh failure", () => {
    renderForm({ refreshWarning: true })
    expect(
      screen.getByText("Atualize os dados para ver todas as projeções.")
    ).toBeTruthy()
  })
  it("locks a conflict until data is refreshed", async () => {
    const conflict = Object.assign(new Error("changed"), {
      code: "OPTIMISTIC_CONCURRENCY_FAILURE",
    })
    const { props } = renderForm({
      onSubmit: vi.fn().mockRejectedValue(conflict),
    })
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))
    expect(await screen.findByText("Este lançamento mudou")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Salvar receita" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
  it("shows loading options explicitly", () => {
    state.options = { ...base, loading: true }
    renderForm()
    expect(screen.getByText("Carregando opções da transação…")).toBeTruthy()
  })
  it("shows a refreshable option failure", () => {
    state.options = { ...base, error: new Error("offline") }
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(state.options.refresh).toHaveBeenCalledOnce()
  })
})
