/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { JournalChainListItem } from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { TransactionTable } from "./transaction-table.js"

function transaction(
  overrides: Partial<JournalChainListItem> = {}
): JournalChainListItem {
  return {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    type: "EXPENSE",
    status: "ACTIVE",
    occurredOn: "2026-09-09",
    recordedAt: "2026-09-09T12:00:00.000Z",
    sequence: "1",
    description: "Mercado",
    origin: "MANUAL",
    canEditWithGenericFlow: true,
    amountMinor: "1000",
    currency: "BRL",
    financialAccounts: [],
    categories: [],
    ...overrides,
  }
}

function renderTable(
  overrides: Partial<React.ComponentProps<typeof TransactionTable>> = {}
) {
  const props = {
    transactions: [transaction()],
    selectedIds: new Set<string>(),
    setSelectedIds: vi.fn(),
    expandedId: null,
    setExpandedId: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  return {
    props,
    ...render(
      <MemoryRouter>
        <TransactionTable {...props} />
      </MemoryRouter>
    ),
  }
}

describe("TransactionTable", () => {
  afterEach(cleanup)

  const investment = transaction({
    chainId: "investment-chain",
    description: "Resgate CDB",
    type: "INVESTMENT",
    canEditWithGenericFlow: false,
    amountMinor: "2500",
    currency: "USD",
    occurredOn: "2026-10-01",
    categories: [
      { id: "income", name: "Ganho", kind: "INCOME" },
      { id: "expense", name: "Taxa", kind: "EXPENSE" },
    ],
    investment: {
      operationId: "operation-1",
      positionId: "position-1",
      operationType: "REDEMPTION",
      netCashFlowMinor: "-2500",
      grossAmountMinor: "3000",
      bookCostDeltaMinor: "-2000",
    },
  })

  it("identifies a mixed investment chain without using its first category", () => {
    renderTable({ transactions: [investment] })
    expect(screen.getByText("Investimento")).toBeTruthy()
    expect(screen.queryByText("Ganho")).toBeNull()
  })

  it("shows the signed investment cash flow in the book currency", () => {
    renderTable({ transactions: [investment] })
    const row = screen.getByRole("row", { name: /Resgate CDB/ })
    expect(row.textContent).toContain("-US$ 25,00")
  })

  it("shows a zero investment flow without inventing income or expense", () => {
    renderTable({
      transactions: [
        transaction({
          ...investment,
          amountMinor: "0",
          investment: { ...investment.investment!, netCashFlowMinor: "0" },
        }),
      ],
    })
    const row = screen.getByRole("row", { name: /Resgate CDB/ })
    expect(row.textContent).toContain("US$ 0,00")
    expect(row.textContent).not.toContain("+US$ 0,00")
    expect(row.textContent).not.toContain("-US$ 0,00")
  })

  it("shows a positive investment cash flow with a plus sign", () => {
    renderTable({
      transactions: [
        transaction({
          ...investment,
          investment: { ...investment.investment!, netCashFlowMinor: "2500" },
        }),
      ],
    })
    expect(
      screen.getByRole("row", { name: /Resgate CDB/ }).textContent
    ).toContain("+US$ 25,00")
  })

  it("keeps an ISO civil date on the same day in the table", () => {
    renderTable({ transactions: [investment] })
    expect(
      screen.getByRole("row", { name: /Resgate CDB/ }).textContent
    ).toContain("01/10/2026")
  })

  it("links an investment action to its position and hides generic actions", () => {
    renderTable({ transactions: [investment] })
    fireEvent.click(
      screen.getByRole("button", { name: "Ações para Resgate CDB" })
    )
    expect(
      screen
        .getByRole("menuitem", { name: "Ver operação de investimento" })
        .getAttribute("href")
    ).toBe("/investments/positions/position-1")
    expect(screen.queryByRole("menuitem", { name: "Editar" })).toBeNull()
    expect(screen.queryByRole("menuitem", { name: "Cancelar" })).toBeNull()
  })

  it("keeps the investment link on a cancelled chain", () => {
    renderTable({
      transactions: [transaction({ ...investment, status: "CANCELLED" })],
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Ações para Resgate CDB" })
    )
    expect(
      screen.getByRole("menuitem", { name: "Ver operação de investimento" })
    ).toBeTruthy()
  })

  it("does not offer generic actions when the read model forbids them", () => {
    renderTable({
      transactions: [transaction({ canEditWithGenericFlow: false })],
    })
    expect(
      screen.queryByRole("button", { name: "Ações para Mercado" })
    ).toBeNull()
  })

  it("opens the Shadcn action menu and dispatches edit without expanding the row", () => {
    const { props } = renderTable()

    fireEvent.click(screen.getByRole("button", { name: "Ações para Mercado" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }))

    expect(props.onEdit).toHaveBeenCalledWith(transaction())
    expect(props.setExpandedId).not.toHaveBeenCalled()
  })

  it("dispatches cancellation for an edited chain", () => {
    const edited = transaction({ status: "EDITED", description: "Aluguel" })
    const { props } = renderTable({ transactions: [edited] })

    fireEvent.click(screen.getByRole("button", { name: "Ações para Aluguel" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancelar" }))

    expect(props.onCancel).toHaveBeenCalledWith(edited)
  })

  it("opens the action menu by keyboard and marks cancellation destructive", () => {
    renderTable()
    const trigger = screen.getByRole("button", { name: "Ações para Mercado" })

    trigger.focus()
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" })

    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeTruthy()
    expect(
      screen
        .getByRole("menuitem", { name: "Cancelar" })
        .getAttribute("data-variant")
    ).toBe("destructive")
  })

  it("does not expose actions for a cancelled chain", () => {
    renderTable({ transactions: [transaction({ status: "CANCELLED" })] })

    expect(
      screen.queryByRole("button", { name: "Ações para Mercado" })
    ).toBeNull()
  })

  it("blocks only the target action while its details load", () => {
    renderTable({ actionPendingChainId: "chain-1" })

    expect(
      screen
        .getByRole("button", { name: "Ações para Mercado" })
        .hasAttribute("disabled")
    ).toBe(true)
  })
})
