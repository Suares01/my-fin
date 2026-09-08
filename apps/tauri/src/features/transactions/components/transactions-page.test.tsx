/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  activeBook: vi.fn(),
  chains: vi.fn(),
  options: vi.fn(),
}))

vi.mock("../../../providers/use-active-book.js", () => ({
  useActiveBook: () => mocks.activeBook(),
}))
vi.mock("../hooks/use-transaction-chains.js", () => ({
  useTransactionChains: () => mocks.chains(),
}))
vi.mock("../hooks/use-transaction-form-options.js", () => ({
  useTransactionFormOptions: (type: string) => mocks.options(type),
}))
vi.mock("./transaction-summary.js", () => ({
  TransactionSummary: ({ items }: { items: unknown[] }) => (
    <div>Resumo {items.length}</div>
  ),
}))
vi.mock("./transaction-filters.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./transaction-filters.js")>()
  return {
    ...actual,
    TransactionFilters: ({ onReset }: { onReset: () => void }) => (
      <button type="button" onClick={onReset}>
        Limpar filtros
      </button>
    ),
  }
})
vi.mock("./transaction-table.js", () => ({
  TransactionTable: ({
    transactions,
    onLoadMore,
  }: {
    transactions: unknown[]
    onLoadMore: () => void
  }) => (
    <div>
      Tabela {transactions.length}
      <button type="button" onClick={onLoadMore}>
        Carregar mais resultados
      </button>
    </div>
  ),
}))

import { TransactionsPage } from "./transactions-page.js"

function item() {
  return {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    status: "ACTIVE",
    type: "INCOME",
    occurredOn: "2026-09-08",
    recordedAt: "2026-09-08T12:00:00.000Z",
    sequence: "1",
    description: "Receita",
    origin: "MANUAL",
    amountMinor: "100",
    currency: "BRL",
    financialAccounts: [],
    categories: [],
  }
}

function setup(bookId: string | null = "book-1") {
  mocks.activeBook.mockReturnValue(
    bookId
      ? { session: { status: "ACTIVE", bookId } }
      : { session: { status: "UNRESOLVED" } }
  )
  mocks.chains.mockReturnValue({
    data: { items: [item()] },
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  })
  mocks.options.mockReturnValue({ accounts: [], categories: [] })
  return render(<TransactionsPage />)
}

describe("TransactionsPage", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders the transaction content", () => {
    setup()
    expect(screen.getByRole("heading", { name: "Transações" })).toBeTruthy()
    expect(screen.getByText("Resumo 1")).toBeTruthy()
    expect(screen.getByText("Tabela 1")).toBeTruthy()
  })

  it("does not retain a local creation action", () => {
    setup()
    expect(screen.queryByRole("button", { name: "Nova transação" })).toBeNull()
  })

  it("uses the active-book query and form options", () => {
    setup()
    expect(mocks.chains).toHaveBeenCalledOnce()
    expect(mocks.options).toHaveBeenCalledWith("INCOME")
  })

  it("passes pagination to the transaction table", () => {
    setup()
    const fetchNextPage = mocks.chains().fetchNextPage
    fireEvent.click(
      screen.getByRole("button", { name: "Carregar mais resultados" })
    )
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it("shows unresolved-book guidance", () => {
    setup(null)
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })
})
