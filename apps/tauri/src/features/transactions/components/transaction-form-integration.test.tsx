/* @vitest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalChainDetail } from "@workspace/application"
import {
  renderTransactionForm as render,
  selectOption,
} from "../testing/form-test-utils"
import { TransactionCreateDrawer } from "./transaction-create-drawer"
import { TransactionOverlay } from "./transaction-overlay"

const mutations = vi.hoisted(() => ({
  income: vi.fn(),
  expense: vi.fn(),
  transfer: vi.fn(),
  amend: vi.fn(),
}))
vi.mock("../hooks/use-record-income.js", () => ({
  useRecordIncome: () => ({
    mutateAsync: mutations.income,
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-record-expense.js", () => ({
  useRecordExpense: () => ({
    mutateAsync: mutations.expense,
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-transfer-money.js", () => ({
  useTransferMoney: () => ({
    mutateAsync: mutations.transfer,
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-amend-transaction.js", () => ({
  useAmendTransaction: () => ({
    mutateAsync: mutations.amend,
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-reverse-transaction.js", () => ({
  useReverseTransaction: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}))
vi.mock("../hooks/use-transaction-form-options", () => ({
  useTransactionFormOptions: () => ({
    bookId: "book-1",
    baseCurrency: "BRL",
    loading: false,
    error: null,
    accounts: [
      { id: "a1", name: "Carteira" },
      { id: "a2", name: "Banco" },
    ],
    categories: [{ id: "c1", name: "Categoria teste" }],
    missingAccounts: false,
    missingCategories: false,
    requiresTwoAccounts: false,
    refresh: vi.fn(),
  }),
}))

const cases = [
  { type: "INCOME", kind: "income", label: "receita" },
  { type: "EXPENSE", kind: "expense", label: "despesa" },
  { type: "TRANSFER", kind: "transfer", label: "transferência" },
] as const

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 8, 8, 12))
  for (const mutation of Object.values(mutations))
    mutation.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe.each(cases)("$type form integration", ({ type, kind, label }) => {
  it("passes the exact creation draft to its mutation and closes only after resolution", async () => {
    let finish!: () => void
    mutations[kind].mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const close = vi.fn()
    const { rerender } = render(
      <TransactionCreateDrawer
        bookId="book-1"
        open
        transactionType={type}
        onOpenChange={close}
      />
    )
    if (type === "TRANSFER") {
      selectOption("Conta de origem", "Carteira")
      selectOption("Conta de destino", "Banco")
    } else {
      selectOption("Conta", "Carteira")
      selectOption("Categoria", "Categoria teste")
    }
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "12,34" },
    })
    fireEvent.click(screen.getByLabelText("Data"))
    fireEvent.click(
      screen.getByRole("button", {
        name: "quinta-feira, 3 de setembro de 2026",
      })
    )
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "  Teste  " },
    })
    fireEvent.click(screen.getByRole("button", { name: `Salvar ${label}` }))
    await waitFor(() =>
      expect(mutations[kind]).toHaveBeenCalledWith({
        bookId: "book-1",
        draft: {
          type,
          ...(type === "TRANSFER"
            ? { sourceAccountId: "a1", destinationAccountId: "a2" }
            : { accountId: "a1", categoryId: "c1" }),
          amountMinor: "1234",
          currency: "BRL",
          occurredOn: "2026-09-03",
          description: "Teste",
        },
      })
    )
    expect(close).not.toHaveBeenCalled()
    await act(async () => finish())
    await waitFor(() => expect(close).toHaveBeenCalledWith(false))
    rerender(
      <TransactionCreateDrawer
        bookId="book-1"
        open={false}
        transactionType={type}
        onOpenChange={close}
      />
    )
    rerender(
      <TransactionCreateDrawer
        bookId="book-1"
        open
        transactionType={type}
        onOpenChange={close}
      />
    )
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe(
      ""
    )
  })

  it("prefills and submits an amendment through the existing overlay", async () => {
    const detail: JournalChainDetail = {
      chainId: "chain-1",
      presentedEntryId: "entry-1",
      presentedVersion: 3,
      type,
      status: "ACTIVE",
      occurredOn: "2026-09-03",
      recordedAt: "2026-09-03T12:00:00Z",
      sequence: "1",
      description: "Antes",
      origin: "MANUAL",
      amountMinor: "1000",
      currency: "BRL",
      financialAccounts: [{ id: "a1", name: "Carteira", kind: "ASSET" }],
      categories: [{ id: "c1", name: "Categoria teste", kind: "INCOME" }],
      ...(type === "TRANSFER"
        ? {
            transfer: {
              source: { id: "a1", name: "Carteira", kind: "ASSET" as const },
              destination: { id: "a2", name: "Banco", kind: "ASSET" as const },
            },
          }
        : {}),
      postings: [],
      history: [],
    }
    const close = vi.fn()
    const success = vi.fn()
    const { rerender } = render(
      <TransactionOverlay
        bookId="book-1"
        state={{ kind: "closed" }}
        onStateChange={close}
        onSuccess={success}
      />
    )
    rerender(
      <TransactionOverlay
        bookId="book-1"
        state={{ kind, detail }}
        onStateChange={close}
        onSuccess={success}
      />
    )
    close.mockClear()
    expect(
      (screen.getByLabelText("Valor") as HTMLInputElement).value.replace(
        /\s/g,
        " "
      )
    ).toBe("R$ 10,00")
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Depois" },
    })
    fireEvent.click(screen.getByRole("button", { name: `Salvar ${label}` }))
    await waitFor(() =>
      expect(mutations.amend).toHaveBeenCalledWith({
        bookId: "book-1",
        chainId: "chain-1",
        presentedEntryId: "entry-1",
        presentedVersion: 3,
        previousDetail: detail,
        replacement: {
          type,
          ...(type === "TRANSFER"
            ? { sourceAccountId: "a1", destinationAccountId: "a2" }
            : { accountId: "a1", categoryId: "c1" }),
          amountMinor: "1000",
          currency: "BRL",
          occurredOn: "2026-09-03",
          description: "Depois",
        },
      })
    )
    expect(mutations[kind]).not.toHaveBeenCalled()
    expect(success).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledWith({ kind: "closed" })
  })
})
