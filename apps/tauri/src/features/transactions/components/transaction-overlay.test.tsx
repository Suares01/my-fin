/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TransactionOverlay } from "./transaction-overlay.js"
vi.mock("./income-form.js", () => ({
  IncomeForm: () => <div>Formulário de receita</div>,
}))
vi.mock("./expense-form.js", () => ({
  ExpenseForm: () => <div>Formulário de despesa</div>,
}))
vi.mock("./transfer-form.js", () => ({
  TransferForm: () => <div>Formulário de transferência</div>,
}))
vi.mock("./transaction-delete-dialog.js", () => ({
  TransactionDeleteDialog: () => <div>Confirmação de exclusão</div>,
}))
function renderOverlay(
  state: React.ComponentProps<typeof TransactionOverlay>["state"] = {
    kind: "create",
  },
  bookId: string | null = "book-1"
) {
  const props = { bookId, state, onStateChange: vi.fn(), onSuccess: vi.fn() }
  return { props, ...render(<TransactionOverlay {...props} />) }
}
describe("TransactionOverlay", () => {
  afterEach(cleanup)
  it("offers exactly three create choices", () => {
    renderOverlay()
    expect(
      ["Receita", "Despesa", "Transferência"].map((name) =>
        screen.getByRole("button", { name })
      )
    ).toHaveLength(3)
  })
  it("opens income form", () => {
    const { props } = renderOverlay()
    fireEvent.click(screen.getByRole("button", { name: "Receita" }))
    expect(props.onStateChange).toHaveBeenCalledWith({ kind: "income" })
  })
  it("opens expense form", () => {
    const { props } = renderOverlay()
    fireEvent.click(screen.getByRole("button", { name: "Despesa" }))
    expect(props.onStateChange).toHaveBeenCalledWith({ kind: "expense" })
  })
  it("opens transfer form", () => {
    const { props } = renderOverlay()
    fireEvent.click(screen.getByRole("button", { name: "Transferência" }))
    expect(props.onStateChange).toHaveBeenCalledWith({ kind: "transfer" })
  })
  it("renders only income child", () => {
    renderOverlay({ kind: "income" })
    expect(screen.getByText("Formulário de receita")).toBeTruthy()
    expect(screen.queryByText("Formulário de despesa")).toBeNull()
  })
  it("renders only expense child", () => {
    renderOverlay({ kind: "expense" })
    expect(screen.getByText("Formulário de despesa")).toBeTruthy()
    expect(screen.queryByText("Formulário de transferência")).toBeNull()
  })
  it("renders only transfer child", () => {
    renderOverlay({ kind: "transfer" })
    expect(screen.getByText("Formulário de transferência")).toBeTruthy()
    expect(screen.queryByText("Formulário de receita")).toBeNull()
  })
  it("renders only delete child", () => {
    renderOverlay({ kind: "delete", detail: {} as never })
    expect(screen.getByText("Confirmação de exclusão")).toBeTruthy()
  })
  it("uses full mobile width", () => {
    renderOverlay({ kind: "income" })
    expect(screen.getByLabelText("Receita").className).toContain("w-full")
  })
  it("supplies localized accessible title", () => {
    renderOverlay({ kind: "transfer" })
    expect(screen.getByLabelText("Transferência")).toBeTruthy()
  })
  it("closes on book change", () => {
    const { props, rerender } = renderOverlay({ kind: "income" })
    rerender(<TransactionOverlay {...props} bookId="book-2" />)
    expect(props.onStateChange).toHaveBeenLastCalledWith({ kind: "closed" })
  })
  it("starts closed without rendering a surface", () => {
    renderOverlay({ kind: "closed" })
    expect(screen.queryByText("Nova transação")).toBeNull()
  })
})
