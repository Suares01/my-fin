/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ExpenseTransactionDraft } from "./expense-form.js"
import type { IncomeTransactionDraft } from "./income-form.js"
import type { TransferTransactionDraft } from "./transfer-form.js"

const mutations = vi.hoisted(() => ({
  income: vi.fn(),
  expense: vi.fn(),
  transfer: vi.fn(),
}))

const incomeDraft: IncomeTransactionDraft = {
  type: "INCOME",
  accountId: "account-1",
  categoryId: "category-1",
  amountMinor: "100",
  currency: "BRL",
  occurredOn: "2026-09-08",
  description: "Receita",
}
const expenseDraft: ExpenseTransactionDraft = {
  ...incomeDraft,
  type: "EXPENSE",
}
const transferDraft: TransferTransactionDraft = {
  type: "TRANSFER",
  sourceAccountId: "account-1",
  destinationAccountId: "account-2",
  amountMinor: "100",
  currency: "BRL",
  occurredOn: "2026-09-08",
  description: "Transferência",
}

vi.mock("../hooks/use-record-income.js", () => ({
  useRecordIncome: () => mutations.income(),
}))
vi.mock("../hooks/use-record-expense.js", () => ({
  useRecordExpense: () => mutations.expense(),
}))
vi.mock("../hooks/use-transfer-money.js", () => ({
  useTransferMoney: () => mutations.transfer(),
}))
vi.mock("./income-form.js", () => ({
  IncomeForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (draft: IncomeTransactionDraft) => Promise<void>
    onCancel: () => void
  }) => (
    <div>
      <p>Formulário de receita</p>
      <button
        type="button"
        onClick={() => void onSubmit(incomeDraft).catch(() => undefined)}
      >
        Salvar receita
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar receita
      </button>
    </div>
  ),
}))
vi.mock("./expense-form.js", () => ({
  ExpenseForm: ({
    onSubmit,
  }: {
    onSubmit: (draft: ExpenseTransactionDraft) => Promise<void>
  }) => (
    <div>
      <p>Formulário de despesa</p>
      <button
        type="button"
        onClick={() => void onSubmit(expenseDraft).catch(() => undefined)}
      >
        Salvar despesa
      </button>
    </div>
  ),
}))
vi.mock("./transfer-form.js", () => ({
  TransferForm: ({
    onSubmit,
  }: {
    onSubmit: (draft: TransferTransactionDraft) => Promise<void>
  }) => (
    <div>
      <p>Formulário de transferência</p>
      <button
        type="button"
        onClick={() => void onSubmit(transferDraft).catch(() => undefined)}
      >
        Salvar transferência
      </button>
    </div>
  ),
}))

import { TransactionCreateDrawer } from "./transaction-create-drawer.js"

function mutation(mutateAsync = vi.fn().mockResolvedValue({})) {
  return { mutateAsync, isPending: false, error: null }
}

function renderDrawer(
  type: React.ComponentProps<
    typeof TransactionCreateDrawer
  >["transactionType"] = "INCOME",
  onOpenChange = vi.fn()
) {
  return {
    onOpenChange,
    ...render(
      <TransactionCreateDrawer
        bookId="book-1"
        open
        transactionType={type}
        onOpenChange={onOpenChange}
      />
    ),
  }
}

describe("TransactionCreateDrawer", () => {
  beforeEach(() => {
    mutations.income.mockReturnValue(mutation())
    mutations.expense.mockReturnValue(mutation())
    mutations.transfer.mockReturnValue(mutation())
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders a non-modal right drawer with its backdrop", () => {
    renderDrawer()

    expect(
      document.querySelector('[data-slot="transaction-create-drawer-backdrop"]')
    ).toBeTruthy()
    expect(
      document
        .querySelector('[data-slot="drawer-content"]')
        ?.getAttribute("data-vaul-drawer-direction")
    ).toBe("right")
  })

  it.each([
    ["INCOME", "Formulário de receita"],
    ["EXPENSE", "Formulário de despesa"],
    ["TRANSFER", "Formulário de transferência"],
  ] as const)("renders only the %s form", (type, form) => {
    renderDrawer(type)

    for (const candidate of [
      "Formulário de receita",
      "Formulário de despesa",
      "Formulário de transferência",
    ]) {
      if (candidate === form) expect(screen.getByText(candidate)).toBeTruthy()
      else expect(screen.queryByText(candidate)).toBeNull()
    }
  })

  it("closes only after a successful mutation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({})
    mutations.income.mockReturnValue(mutation(mutateAsync))
    const { onOpenChange } = renderDrawer()

    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(mutateAsync).toHaveBeenCalledWith({
      bookId: "book-1",
      draft: incomeDraft,
    })
  })

  it("keeps the drawer open when the mutation rejects", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("offline"))
    mutations.income.mockReturnValue(mutation(mutateAsync))
    const { onOpenChange } = renderDrawer()

    fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce())
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByText("Formulário de receita")).toBeTruthy()
  })

  it("closes through the existing form cancellation control", () => {
    const { onOpenChange } = renderDrawer()

    fireEvent.click(screen.getByRole("button", { name: "Cancelar receita" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
