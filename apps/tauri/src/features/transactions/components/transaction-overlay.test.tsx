/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  TransactionOverlay,
  type TransactionOverlayState,
} from "./transaction-overlay.js"
vi.mock("../hooks/use-record-income.js", () => ({
  useRecordIncome: () => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  }),
}))
vi.mock("../hooks/use-record-expense.js", () => ({
  useRecordExpense: () => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  }),
}))
vi.mock("../hooks/use-transfer-money.js", () => ({
  useTransferMoney: () => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  }),
}))
vi.mock("../hooks/use-amend-transaction.js", () => ({
  useAmendTransaction: () => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  }),
}))
vi.mock("../hooks/use-reverse-transaction.js", () => ({
  useReverseTransaction: () => ({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  }),
}))
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

function FormFocusLifecycleHarness() {
  const [state, setState] = useState<TransactionOverlayState>({
    kind: "closed",
  })
  return (
    <>
      <button type="button" onClick={() => setState({ kind: "create" })}>
        Nova transação
      </button>
      <TransactionOverlay
        bookId="book-1"
        state={state}
        onStateChange={setState}
        onSuccess={vi.fn()}
      />
    </>
  )
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

  it("contains form focus and restores it after close", async () => {
    render(<FormFocusLifecycleHarness />)
    const trigger = screen.getByRole("button", { name: "Nova transação" })
    trigger.focus()
    fireEvent.click(trigger)

    const firstChoice = await screen.findByRole("button", { name: "Receita" })
    const focusGuards = document.querySelectorAll<HTMLElement>(
      "[data-base-ui-focus-guard]"
    )
    expect(focusGuards).toHaveLength(2)
    focusGuards[1].focus()
    await waitFor(() => expect(document.activeElement).toBe(firstChoice))

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
})
