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
  useTransactionFormOptions: () => mocks.options(),
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
    TransactionFilters: ({
      onChange,
      onReset,
    }: {
      onChange: (value: unknown) => void
      onReset: () => void
    }) => (
      <div>
        <button onClick={() => onChange({})}>Alterar filtros</button>
        <button onClick={onReset}>Limpar filtros</button>
      </div>
    ),
  }
})
vi.mock("./transaction-list.js", () => ({
  TransactionList: (props: {
    items: unknown[]
    onCreate: () => void
    onRetry: () => void
    onLoadMore: () => void
  }) => (
    <div>
      Lista {props.items.length}
      <button onClick={props.onCreate}>Criar na lista</button>
      <button onClick={props.onRetry}>Tentar novamente</button>
      <button onClick={props.onLoadMore}>Carregar mais resultados</button>
    </div>
  ),
}))
vi.mock("./transaction-overlay.js", () => ({
  TransactionOverlay: ({
    state,
    onSuccess,
  }: {
    state: { kind: string }
    onSuccess: () => void
  }) => (
    <div>
      Overlay {state.kind}
      <button onClick={onSuccess}>Concluir</button>
    </div>
  ),
}))
import { TransactionsPage } from "./transactions-page.js"
function item() {
  return {
    chainId: "chain-1",
    status: "ACTIVE",
    type: "INCOME",
    amountMinor: "100",
    currency: "BRL",
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
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
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
  it("renders header", () => {
    setup()
    expect(screen.getByRole("heading", { name: "Transações" })).toBeTruthy()
  })
  it("renders create action", () => {
    setup()
    expect(screen.getByRole("button", { name: "Nova transação" })).toBeTruthy()
  })
  it("renders summary", () => {
    setup()
    expect(screen.getByText("Resumo 1")).toBeTruthy()
  })
  it("renders list", () => {
    setup()
    expect(screen.getByText("Lista 1")).toBeTruthy()
  })
  it("opens create overlay from header", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }))
    expect(screen.getByText("Overlay create")).toBeTruthy()
  })
  it("opens create overlay from empty-list action", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Criar na lista" }))
    expect(screen.getByText("Overlay create")).toBeTruthy()
  })
  it("offers reload guidance after command success", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    expect(
      screen.getByText(/Algumas projeções precisam ser recarregadas/)
    ).toBeTruthy()
  })
  it("reloads projections without another command", () => {
    setup()
    const refetch = mocks.chains().refetch
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
  it("passes retry through to query", () => {
    setup()
    const refetch = mocks.chains().refetch
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
  it("does not expose a pagination action", () => {
    setup()
    expect(
      screen.queryByRole("button", { name: "Carregar mais resultados" })
    ).toBeNull()
  })
  it("shows unresolved book guidance", () => {
    setup(null)
    expect(screen.getByText(/Selecione um livro/)).toBeTruthy()
  })
  it("keeps header action full width on mobile", () => {
    setup()
    expect(
      screen.getByRole("button", { name: "Nova transação" }).className
    ).toContain("w-full")
  })
  it("uses the active book options", () => {
    setup()
    expect(mocks.options).toHaveBeenCalled()
  })
  it("uses the active book transaction query", () => {
    setup()
    expect(mocks.chains).toHaveBeenCalled()
  })
  it("clears filters through the filter action", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(screen.getByText("Lista 1")).toBeTruthy()
  })
  it("accepts filter updates", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Alterar filtros" }))
    expect(screen.getByText("Resumo 0")).toBeTruthy()
  })
  it("closes overlay on successful command", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }))
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    expect(screen.getByText("Overlay closed")).toBeTruthy()
  })
  it("renders at desktop content width", () => {
    setup()
    expect(
      screen.getByRole("heading", { name: "Transações" }).closest("section")
        ?.className
    ).toContain("max-w-6xl")
  })
})
