/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TransactionFilters } from "../transaction-list-model.js"

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
}))

vi.mock("../hooks/use-transaction-summary.js", () => ({
  useTransactionSummary: (filters: unknown) => mocks.summary(filters),
}))

import { TransactionSummary } from "./transaction-summary.js"

const filters: TransactionFilters = {
  from: "2026-09-01",
  to: "2026-09-30",
  search: "mercado",
  types: ["EXPENSE"],
  accountIds: ["account-1"],
  categoryIds: ["category-1"],
  status: "CANCELLED",
}

const data = {
  incomeMinor: "12345",
  expenseMinor: "6789",
  largestTransactionMinor: "9007199254740993",
  transactionCount: 24,
  currency: "BRL",
}

describe("TransactionSummary", () => {
  beforeEach(() => {
    mocks.summary.mockReturnValue({
      data,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("queries and renders the persisted aggregate instead of loaded items", () => {
    render(<TransactionSummary filters={filters} />)

    expect(mocks.summary).toHaveBeenCalledWith(filters)
    expect(screen.getByText("Receita total")).toBeTruthy()
    expect(screen.getByText("Despesa total")).toBeTruthy()
    expect(screen.getByText("Maior transação")).toBeTruthy()
    expect(screen.getByText("Total de transações")).toBeTruthy()
    expect(screen.getByTestId("transaction-summary-income").textContent).toBe(
      "R$ 123,45"
    )
    expect(screen.getByTestId("transaction-summary-expense").textContent).toBe(
      "R$ 67,89"
    )
    expect(screen.getByTestId("transaction-summary-largest").textContent).toBe(
      "R$ 90.071.992.547.409,93"
    )
    expect(screen.getByTestId("transaction-summary-count").textContent).toBe(
      "24"
    )
  })

  it("renders four skeleton values during the initial query", () => {
    mocks.summary.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    })

    const { container } = render(<TransactionSummary filters={filters} />)

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("keeps cards valueless and offers an explicit retry after failure", () => {
    const refetch = vi.fn()
    mocks.summary.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    })

    render(<TransactionSummary filters={filters} />)
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    expect(screen.getAllByText("—")).toHaveLength(4)
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível carregar o resumo"
    )
    expect(refetch).toHaveBeenCalledOnce()
  })

  it("renders successful empty aggregates as zeros in the book currency", () => {
    mocks.summary.mockReturnValue({
      data: {
        incomeMinor: "0",
        expenseMinor: "0",
        largestTransactionMinor: "0",
        transactionCount: 0,
        currency: "USD",
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })

    render(<TransactionSummary filters={filters} />)

    expect(screen.getByTestId("transaction-summary-income").textContent).toBe(
      "US$ 0,00"
    )
    expect(screen.getByTestId("transaction-summary-count").textContent).toBe(
      "0"
    )
  })
})
