/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { JournalChainListItem } from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
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
  return { props, ...render(<TransactionTable {...props} />) }
}

describe("TransactionTable", () => {
  afterEach(cleanup)

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
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Cancelar lançamento" })
    )

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
        .getByRole("menuitem", { name: "Cancelar lançamento" })
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
