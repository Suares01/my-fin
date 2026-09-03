/* @vitest-environment jsdom */

import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useTransactionFormOptions } from "./use-transaction-form-options.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = vi.hoisted((): any => ({
  session: { status: "ACTIVE" as const, bookId: "book-1" },
  book: {
    data: { baseCurrency: "BRL" },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  },
  accounts: { data: [], isLoading: false, error: null, refetch: vi.fn() },
  income: { data: [], isLoading: false, error: null, refetch: vi.fn() },
  expense: { data: [], isLoading: false, error: null, refetch: vi.fn() },
}))
vi.mock("../../../providers/use-active-book.js", () => ({
  useActiveBook: () => ({ session: state.session }),
}))
vi.mock("../../books/hooks/use-book-detail.js", () => ({
  useBookDetail: () => state.book,
}))
vi.mock("../../accounts/hooks/use-account-balances.js", () => ({
  useAccountBalances: () => state.accounts,
}))
vi.mock("../../categories/hooks/use-income-categories.js", () => ({
  useIncomeCategories: () => state.income,
}))
vi.mock("../../categories/hooks/use-expense-categories.js", () => ({
  useExpenseCategories: () => state.expense,
}))

const active = {
  accountId: "a1",
  accountName: "Carteira",
  currency: "BRL",
  archived: false,
}
beforeEach(() => {
  state.session = { status: "ACTIVE", bookId: "book-1" }
  state.book = {
    data: { baseCurrency: "BRL" },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }
  state.accounts = {
    data: [active],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }
  state.income = {
    data: [{ id: "i1", name: "Salário", kind: "INCOME" }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }
  state.expense = {
    data: [{ id: "e1", name: "Mercado", kind: "EXPENSE" }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }
})

describe("useTransactionFormOptions", () => {
  it("exposes the active book and only base-currency financial accounts", () => {
    state.accounts.data = [
      active,
      { ...active, accountId: "usd", currency: "USD" },
    ]
    const { result } = renderHook(() => useTransactionFormOptions("INCOME"))
    expect(result.current).toMatchObject({
      bookId: "book-1",
      accounts: [{ id: "a1", name: "Carteira" }],
    })
  })
  it("excludes archived accounts", () => {
    state.accounts.data = [{ ...active, archived: true }]
    const { result } = renderHook(() => useTransactionFormOptions("INCOME"))
    expect(result.current.accounts).toEqual([])
  })
  it("selects only income categories for income", () => {
    const { result } = renderHook(() => useTransactionFormOptions("INCOME"))
    expect(result.current.categories).toEqual([{ id: "i1", name: "Salário" }])
  })
  it("selects only expense categories for expense", () => {
    const { result } = renderHook(() => useTransactionFormOptions("EXPENSE"))
    expect(result.current.categories).toEqual([{ id: "e1", name: "Mercado" }])
  })
  it("does not expose categories for transfers", () => {
    const { result } = renderHook(() => useTransactionFormOptions("TRANSFER"))
    expect(result.current.categories).toEqual([])
  })
  it("marks a missing account state after loading", () => {
    state.accounts.data = []
    const { result } = renderHook(() => useTransactionFormOptions("INCOME"))
    expect(result.current.missingAccounts).toBe(true)
  })
  it("marks a missing category state after loading", () => {
    state.income.data = []
    const { result } = renderHook(() => useTransactionFormOptions("INCOME"))
    expect(result.current.missingCategories).toBe(true)
  })
  it("marks transfer unavailable with fewer than two accounts", () => {
    const { result } = renderHook(() => useTransactionFormOptions("TRANSFER"))
    expect(result.current.requiresTwoAccounts).toBe(true)
  })
  it("surfaces loading or errors and refreshes its option sources", async () => {
    state.accounts.isLoading = true
    const { result, rerender } = renderHook(() =>
      useTransactionFormOptions("INCOME")
    )
    expect(result.current.loading).toBe(true)
    state.accounts.isLoading = false
    state.accounts.error = new Error("offline")
    rerender()
    expect(result.current.error?.message).toBe("offline")
    await result.current.refresh()
    expect(state.income.refetch).toHaveBeenCalledOnce()
  })
})
