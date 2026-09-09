import { renderTransactionForm as render } from "../testing/form-test-utils"
/* @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
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
  selectOption("Conta", "Carteira")
  selectOption("Categoria", "Salário")
  fireEvent.change(screen.getByLabelText("Valor"), {
    target: { value: "10,00" },
  })
  selectDate()
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Salário" },
  })
}
function selectOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }))
  const optionElement = screen.getByRole("option", { name: option })
  fireEvent.pointerDown(optionElement)
  fireEvent.click(optionElement)
}
function selectDate() {
  fireEvent.click(screen.getByLabelText("Data"))
  fireEvent.click(
    screen.getByRole("button", {
      name: "quinta-feira, 3 de setembro de 2026",
    })
  )
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 8, 8, 12))
  state.options = { ...base, refresh: vi.fn() }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
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
    selectOption("Conta", "Conta renomeada")
    expect(
      screen.getByRole("combobox", { name: "Conta" }).textContent
    ).toContain("Conta renomeada")
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
    expect(
      await screen.findByText(
        "Este lançamento mudou. Atualize os dados antes de tentar novamente."
      )
    ).toBeTruthy()
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

  it("revalidates changed fields after the first submit and focuses the first error", async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: " " },
    })
    fireEvent.blur(screen.getByLabelText("Descrição"))
    expect(screen.queryByText("Informe uma descrição.")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))
    expect(await screen.findByText("Informe uma descrição.")).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Conta"))
    )
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Corrigido" },
    })
    await waitFor(() =>
      expect(screen.queryByText("Informe uma descrição.")).toBeNull()
    )
  })
  it("waits for onSubmit without external pending and prevents concurrent submissions", async () => {
    let finish!: () => void
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    renderForm({ onSubmit })
    fill()
    const button = screen.getByRole("button", { name: "Salvar receita" })
    fireEvent.click(button)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(
      screen
        .getByRole("button", { name: "Salvando receita" })
        .hasAttribute("disabled")
    ).toBe(true)
    for (const name of ["Valor", "Data", "Descrição"])
      expect(screen.getByLabelText(name).hasAttribute("disabled")).toBe(true)
    fireEvent.click(button)
    expect(onSubmit).toHaveBeenCalledOnce()
    await act(async () => finish())
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Salvar receita" })
          .hasAttribute("disabled")
      ).toBe(false)
    )
  })
  it("uses the book currency when options arrive asynchronously", async () => {
    state.options = { ...base, loading: true, baseCurrency: undefined }
    const { props, rerender } = renderForm()
    state.options = { ...base, baseCurrency: "USD" }
    rerender(<IncomeForm {...props} />)
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))
    await waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "USD", amountMinor: "1000" })
      )
    )
    expect(
      (screen.getByLabelText("Valor") as HTMLInputElement).value.replace(
        /\s/g,
        " "
      )
    ).toBe("US$ 10,00")
  })
  it("preserves edits when options refresh", () => {
    const { props, rerender } = renderForm()
    fill()
    const previous = (screen.getByLabelText("Descrição") as HTMLInputElement)
      .value
    state.options = {
      ...base,
      accounts: base.accounts.map((account) => ({
        ...account,
        name: "Renomeada",
      })),
    }
    rerender(<IncomeForm {...props} />)
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe(
      previous
    )
  })
  it("blocks unsafe edit amounts and allows closing", () => {
    const { props } = renderForm({
      initialDraft: {
        type: "INCOME",
        accountId: "a1",
        categoryId: "c1",
        amountMinor: "9223372036854775807",
        currency: "BRL",
        occurredOn: "2026-09-03",
        description: "Antes",
      },
    })
    expect(
      screen.getByText("Valor acima do limite seguro do formulário")
    ).toBeTruthy()
    expect(screen.queryByLabelText("Valor")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
