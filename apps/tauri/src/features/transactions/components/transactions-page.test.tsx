/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  activeBook: vi.fn(),
  chains: vi.fn(),
  chainsResult: vi.fn(),
  summary: vi.fn(),
  options: vi.fn(),
}))

vi.mock("../../../providers/use-active-book.js", () => ({
  useActiveBook: () => mocks.activeBook(),
}))
vi.mock("../hooks/use-transaction-chains.js", () => ({
  useTransactionChains: (filters: unknown) => {
    mocks.chains(filters)
    return mocks.chainsResult()
  },
}))
vi.mock("../hooks/use-transaction-form-options.js", () => ({
  useTransactionFormOptions: (type: string) => mocks.options(type),
}))
vi.mock("./transaction-summary.js", () => ({
  TransactionSummary: ({ filters }: { filters: unknown }) => {
    mocks.summary(filters)
    return <div>Resumo</div>
  },
}))
vi.mock("./transaction-filters.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./transaction-filters.js")>()
  return {
    ...actual,
    TransactionFilters: ({
      filters,
      onChange,
      onReset,
    }: {
      filters: typeof actual.emptyTransactionFilters
      onChange: (filters: typeof actual.emptyTransactionFilters) => void
      onReset: () => void
    }) => (
      <div>
        <output data-testid="search-value">{filters.search}</output>
        <button
          type="button"
          onClick={() => onChange({ ...filters, search: "Mercado" })}
        >
          Buscar Mercado
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              from: "2026-09-01",
              to: "2026-09-30",
              types: ["EXPENSE"],
              accountIds: ["account-1"],
              categoryIds: ["category-1"],
              status: "CANCELLED",
            })
          }
        >
          Alterar filtros
        </button>
        <button type="button" onClick={onReset}>
          Limpar filtros
        </button>
      </div>
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

function item(
  overrides: Partial<{
    chainId: string
    status: "ACTIVE" | "CANCELLED"
  }> = {}
) {
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
    ...overrides,
  }
}

function setup(bookId: string | null = "book-1") {
  mocks.activeBook.mockReturnValue(
    bookId
      ? { session: { status: "ACTIVE", bookId } }
      : { session: { status: "UNRESOLVED" } }
  )
  mocks.chainsResult.mockReturnValue({
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
    expect(screen.getByText("Resumo")).toBeTruthy()
    expect(screen.getByText("Tabela 1")).toBeTruthy()
  })

  it("does not retain a local creation action", () => {
    setup()
    expect(screen.queryByRole("button", { name: "Nova transação" })).toBeNull()
  })

  it("uses the active-book query and form options", () => {
    setup()
    expect(mocks.chains).toHaveBeenCalledOnce()
    expect(mocks.summary).toHaveBeenCalledOnce()
    expect(mocks.options).toHaveBeenCalledWith("INCOME")
  })

  it("passes pagination to the transaction table", () => {
    setup()
    const fetchNextPage = mocks.chainsResult().fetchNextPage
    fireEvent.click(
      screen.getByRole("button", { name: "Carregar mais resultados" })
    )
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it("keeps the input immediate and defers only search in the query filters", async () => {
    setup()

    fireEvent.click(screen.getByRole("button", { name: "Alterar filtros" }))
    expect(mocks.chains).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: "2026-09-01",
        to: "2026-09-30",
        types: ["EXPENSE"],
        accountIds: ["account-1"],
        categoryIds: ["category-1"],
        status: "CANCELLED",
        search: "",
      })
    )
    expect(mocks.summary).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: "2026-09-01",
        to: "2026-09-30",
        types: ["EXPENSE"],
        accountIds: ["account-1"],
        categoryIds: ["category-1"],
        status: "CANCELLED",
        search: "",
      })
    )

    fireEvent.click(screen.getByRole("button", { name: "Buscar Mercado" }))
    expect(screen.getByTestId("search-value").textContent).toBe("Mercado")
    await waitFor(() =>
      expect(mocks.chains).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: "2026-09-01",
          to: "2026-09-30",
          types: ["EXPENSE"],
          accountIds: ["account-1"],
          categoryIds: ["category-1"],
          status: "CANCELLED",
          search: "Mercado",
        })
      )
    )
    await waitFor(() =>
      expect(mocks.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "Mercado" })
      )
    )
  })

  it("keeps status filtering local to the loaded transaction items", () => {
    mocks.activeBook.mockReturnValue({
      session: { status: "ACTIVE", bookId: "book-1" },
    })
    mocks.chainsResult.mockReturnValue({
      data: {
        items: [item(), item({ chainId: "chain-2", status: "CANCELLED" })],
      },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    })
    mocks.options.mockReturnValue({ accounts: [], categories: [] })
    render(<TransactionsPage />)

    expect(screen.getByText("Tabela 2")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Alterar filtros" }))
    expect(screen.getByText("Tabela 1")).toBeTruthy()
  })

  it("resets the deferred search together with the complete filter state", async () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Buscar Mercado" }))
    await waitFor(() =>
      expect(mocks.chains).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "Mercado" })
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(screen.getByTestId("search-value").textContent).toBe("")
    await waitFor(() =>
      expect(mocks.chains).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: "",
          to: "",
          search: "",
          types: ["INCOME", "EXPENSE", "TRANSFER"],
          accountIds: [],
          categoryIds: [],
          status: "ALL",
        })
      )
    )
    await waitFor(() =>
      expect(mocks.summary).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: "",
          to: "",
          search: "",
          types: ["INCOME", "EXPENSE", "TRANSFER"],
          accountIds: [],
          categoryIds: [],
          status: "ALL",
        })
      )
    )
  })

  it("shows unresolved-book guidance", () => {
    setup(null)
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })
})
