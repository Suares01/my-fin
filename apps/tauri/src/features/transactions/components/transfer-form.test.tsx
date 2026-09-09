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
import { TransferForm } from "./transfer-form.js"
const base = {
  bookId: "book-1",
  baseCurrency: "BRL",
  accounts: [
    { id: "a1", name: "Carteira" },
    { id: "a2", name: "Banco" },
  ],
  categories: [],
  loading: false,
  error: null,
  requiresTwoAccounts: false,
  refresh: vi.fn(),
}
function renderForm(
  overrides: Partial<React.ComponentProps<typeof TransferForm>> = {}
) {
  const props = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<TransferForm {...props} />) }
}
function fill(destination = "a2") {
  selectOption("Conta de origem", "Carteira")
  selectOption("Conta de destino", destination === "a1" ? "Carteira" : "Banco")
  fireEvent.change(screen.getByLabelText("Valor"), {
    target: { value: "10,00" },
  })
  selectDate()
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Reserva" },
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
describe("TransferForm", () => {
  it("emits exactly the validated transfer draft", async () => {
    const { props } = renderForm()
    fill()
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
    await waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        type: "TRANSFER",
        sourceAccountId: "a1",
        destinationAccountId: "a2",
        amountMinor: "1000",
        currency: "BRL",
        occurredOn: "2026-09-03",
        description: "Reserva",
      })
    )
  })
  it("does not render a category selector", () => {
    renderForm()
    expect(screen.queryByLabelText("Categoria")).toBeNull()
  })
  it("prefills the edit draft", () => {
    renderForm({
      initialDraft: {
        type: "TRANSFER",
        sourceAccountId: "a1",
        destinationAccountId: "a2",
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
  it("rejects equal accounts at the destination field", async () => {
    const { props } = renderForm()
    fill("a1")
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
    expect(await screen.findByText("Escolha contas diferentes.")).toBeTruthy()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
  it("blocks with account creation guidance when fewer than two accounts exist", () => {
    state.options = {
      ...base,
      accounts: [{ id: "a1", name: "Carteira" }],
      requiresTwoAccounts: true,
    }
    renderForm()
    expect(
      screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")
    ).toBe("/accounts")
  })
  it("renders renamed account options", () => {
    state.options = {
      ...base,
      accounts: [
        { id: "a1", name: "Conta nova" },
        { id: "a2", name: "Banco" },
      ],
    }
    renderForm()
    selectOption("Conta de origem", "Conta nova")
    selectOption("Conta de destino", "Conta nova")
    expect(
      screen.getAllByText("Conta nova", { selector: "span" })
    ).toHaveLength(2)
  })
  it("shows amount validation without submitting", async () => {
    const { props } = renderForm()
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
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
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
    expect(
      await screen.findByText("Não foi possível salvar a transação")
    ).toBeTruthy()
    expect(screen.getByLabelText("Descrição").getAttribute("value")).toBe(
      "Reserva"
    )
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
  it("disables submission while pending", () => {
    renderForm({ pending: true })
    expect(
      screen
        .getByRole("button", { name: "Salvando transferência" })
        .hasAttribute("disabled")
    ).toBe(true)
  })
  it("shows refresh warning", () => {
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
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
    expect(
      await screen.findByText(
        "Este lançamento mudou. Atualize os dados antes de tentar novamente."
      )
    ).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Salvar transferência" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
  it("shows loading options", () => {
    state.options = { ...base, loading: true }
    renderForm()
    expect(screen.getByText("Carregando opções da transação…")).toBeTruthy()
  })
  it("retries option loading errors", () => {
    state.options = { ...base, error: new Error("offline") }
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(state.options.refresh).toHaveBeenCalledOnce()
  })
  it("cancels without submitting", () => {
    const { props } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it("revalidates changed fields after the first submit and focuses the first error", async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: " " },
    })
    fireEvent.blur(screen.getByLabelText("Descrição"))
    expect(screen.queryByText("Informe uma descrição.")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
    expect(await screen.findByText("Informe uma descrição.")).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText("Conta de origem")
      )
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
    const button = screen.getByRole("button", { name: "Salvar transferência" })
    fireEvent.click(button)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(
      screen
        .getByRole("button", { name: "Salvando transferência" })
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
          .getByRole("button", { name: "Salvar transferência" })
          .hasAttribute("disabled")
      ).toBe(false)
    )
  })
  it("uses the book currency when options arrive asynchronously", async () => {
    state.options = { ...base, loading: true, baseCurrency: undefined }
    const { props, rerender } = renderForm()
    state.options = { ...base, baseCurrency: "USD" }
    rerender(<TransferForm {...props} />)
    fill()
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
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
    rerender(<TransferForm {...props} />)
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe(
      previous
    )
  })
  it("blocks unsafe edit amounts and allows closing", () => {
    const { props } = renderForm({
      initialDraft: {
        type: "TRANSFER",
        sourceAccountId: "a1",
        destinationAccountId: "a2",
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

  it("revalidates destination when source changes after a rejected submit", async () => {
    renderForm()
    fill("a1")
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar transferência" })
    )
    expect(await screen.findByText("Escolha contas diferentes.")).toBeTruthy()
    selectOption("Conta de origem", "Banco")
    await waitFor(() =>
      expect(screen.queryByText("Escolha contas diferentes.")).toBeNull()
    )
    selectOption("Conta de origem", "Carteira")
    expect(await screen.findByText("Escolha contas diferentes.")).toBeTruthy()
  })
})
