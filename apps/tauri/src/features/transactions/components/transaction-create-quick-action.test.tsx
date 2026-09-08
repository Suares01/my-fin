/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ activeBook: vi.fn() }))

vi.mock("../../../providers", () => ({
  useActiveBook: () => state.activeBook(),
}))
vi.mock("./transaction-create-dropdown.js", () => ({
  TransactionCreateDropdown: ({
    onCreate,
  }: {
    onCreate: (type: "INCOME") => void
  }) => (
    <button type="button" onClick={() => onCreate("INCOME")}>
      Criar transação
    </button>
  ),
}))
vi.mock("./transaction-create-drawer.js", () => ({
  TransactionCreateDrawer: ({
    bookId,
    open,
    transactionType,
  }: {
    bookId: string
    open: boolean
    transactionType: string
  }) => <p>{`${bookId}:${String(open)}:${transactionType}`}</p>,
}))

import { TransactionCreateQuickAction } from "./transaction-create-quick-action.js"

describe("TransactionCreateQuickAction", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("is not available without an active book", () => {
    state.activeBook.mockReturnValue({ session: { status: "UNRESOLVED" } })

    render(<TransactionCreateQuickAction />)

    expect(screen.queryByRole("button", { name: "Criar transação" })).toBeNull()
  })

  it("opens the selected form in the active book drawer", () => {
    state.activeBook.mockReturnValue({
      session: { status: "ACTIVE", bookId: "book-1" },
    })
    render(<TransactionCreateQuickAction />)

    fireEvent.click(screen.getByRole("button", { name: "Criar transação" }))

    expect(screen.getByText("book-1:true:INCOME")).toBeTruthy()
  })
})
