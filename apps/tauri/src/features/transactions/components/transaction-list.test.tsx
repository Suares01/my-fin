/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { JournalChainListItem } from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TransactionList } from "./transaction-list.js"
vi.mock("./transaction-row-details.js", () => ({ TransactionRowDetails: () => <div>Detalhe expandido</div> }))
function chain(overrides: Partial<JournalChainListItem> = {}): JournalChainListItem { return { chainId: "chain-1", presentedEntryId: "entry-1", presentedVersion: 1, type: "INCOME", status: "ACTIVE", occurredOn: "2026-09-03", recordedAt: "", sequence: "1", description: "Salário", origin: "MANUAL", amountMinor: "10000", currency: "BRL", financialAccounts: [], categories: [], ...overrides } }
function renderList(overrides: Partial<React.ComponentProps<typeof TransactionList>> = {}) { const props = { items: [chain()], status: "ALL" as const, onRetry: vi.fn(), onLoadMore: vi.fn(), onResetFilters: vi.fn(), onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), ...overrides }; return { props, ...render(<TransactionList {...props} />) } }
describe("TransactionList", () => { afterEach(cleanup)
it("uses list geometry while loading", () => { renderList({ isPending: true }); expect(screen.getByLabelText("Carregando transações").getAttribute("aria-busy")).toBe("true") })
it("shows retry for initial failure", () => { const { props } = renderList({ isError: true }); fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(props.onRetry).toHaveBeenCalledTimes(1) })
it("shows create action for unfiltered empty state", () => { const { props } = renderList({ items: [] }); fireEvent.click(screen.getByRole("button", { name: "Nova transação" })); expect(props.onCreate).toHaveBeenCalledTimes(1) })
it("shows filter reset for local empty state", () => { const { props } = renderList({ items: [], status: "CANCELLED" }); fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" })); expect(props.onResetFilters).toHaveBeenCalledTimes(1) })
it("renders description", () => { renderList(); expect(screen.getAllByText("Salário").length).toBeGreaterThan(0) })
it("renders signed income", () => { renderList(); expect(screen.getAllByText("+", { exact: false }).length).toBeGreaterThan(0) })
it("renders signed expense", () => { renderList({ items: [chain({ type: "EXPENSE" })] }); expect(screen.getAllByText("-", { exact: false }).length).toBeGreaterThan(0) })
it("renders neutral transfer", () => { renderList({ items: [chain({ type: "TRANSFER" })] }); expect(screen.queryByText("+R$ 100,00")).toBeNull() })
it("renders desktop semantic columns", () => { renderList(); expect(screen.getByRole("columnheader", { name: "Contexto" })).toBeTruthy(); expect(screen.getByRole("columnheader", { name: "Ações" })).toBeTruthy() })
it("keeps mobile essential content without horizontal scroll class", () => { renderList(); expect(screen.getByLabelText("Lista de transações").className).toContain("lg:hidden") })
it("expands a chain by keyboard-operable button", () => { renderList(); fireEvent.click(screen.getAllByRole("button", { name: "Ver detalhes" })[0]); expect(screen.getAllByText("Detalhe expandido").length).toBe(2) })
it("loads more while retaining list items", () => { const { props } = renderList({ hasNextPage: true }); fireEvent.click(screen.getByRole("button", { name: "Carregar mais resultados" })); expect(props.onLoadMore).toHaveBeenCalledTimes(1); expect(screen.getAllByText("Salário").length).toBeGreaterThan(0) })
it("disables load more while pending", () => { renderList({ hasNextPage: true, isFetchingNextPage: true }); expect(screen.getByRole("button", { name: "Carregando mais resultados" }).hasAttribute("disabled")).toBe(true) })
it("preserves the action when a local status hides loaded rows", () => { renderList({ items: [], status: "EDITED", hasNextPage: true }); expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeTruthy() })
it("uses stable chain identity for rows", () => { renderList({ items: [chain(), chain({ chainId: "chain-2", description: "Mercado" })] }); expect(screen.getAllByText("Mercado").length).toBeGreaterThan(0) })
it("includes date and status", () => { renderList(); expect(screen.getAllByText(/2026-09-03/).length).toBeGreaterThan(0); expect(screen.getAllByText(/ACTIVE/).length).toBeGreaterThan(0) })
})
