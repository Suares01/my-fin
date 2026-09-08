/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  options: null as unknown,
  mutateAsync: vi.fn(),
}))

vi.mock("../hooks/use-transaction-form-options.js", () => ({
  useTransactionFormOptions: () => state.options,
}))
vi.mock("../hooks/use-record-income.js", () => ({
  useRecordIncome: () => ({
    mutateAsync: state.mutateAsync,
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-record-expense.js", () => ({
  useRecordExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-transfer-money.js", () => ({
  useTransferMoney: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

import { TransactionCreateDrawer } from "./transaction-create-drawer.js"

function fillIncomeForm() {
  fireEvent.change(screen.getByLabelText("Conta"), {
    target: { value: "account-1" },
  })
  fireEvent.change(screen.getByLabelText("Categoria"), {
    target: { value: "category-1" },
  })
  fireEvent.change(screen.getByLabelText("Valor"), {
    target: { value: "10,00" },
  })
  fireEvent.change(screen.getByLabelText("Data"), {
    target: { value: "2026-09-08" },
  })
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Salário" },
  })
}

describe("TransactionCreateDrawer service failures", () => {
  beforeEach(() => {
    state.options = {
      bookId: "book-1",
      baseCurrency: "BRL",
      accounts: [{ id: "account-1", name: "Carteira" }],
      categories: [{ id: "category-1", name: "Salário" }],
      loading: false,
      error: null,
      missingAccounts: false,
      missingCategories: false,
      refresh: vi.fn(),
    }
    state.mutateAsync.mockRejectedValue(new Error("offline"))
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("keeps the drawer and submitted values while the form reports a mutation failure", async () => {
    const onOpenChange = vi.fn()
    render(
      <TransactionCreateDrawer
        bookId="book-1"
        open
        transactionType="INCOME"
        onOpenChange={onOpenChange}
      />
    )
    fillIncomeForm()

    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))

    expect(
      await screen.findByText("Não foi possível salvar a transação")
    ).toBeTruthy()
    expect(screen.getByLabelText("Descrição").getAttribute("value")).toBe(
      "Salário"
    )
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
