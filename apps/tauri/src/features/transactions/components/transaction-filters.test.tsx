/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  emptyTransactionFilters,
  TransactionFilters,
} from "./transaction-filters.js"

function renderFilters() {
  const props = {
    filters: emptyTransactionFilters,
    accounts: [{ id: "account-1", name: "Conta corrente" }],
    categories: [{ id: "category-1", name: "Mercado" }],
    onChange: vi.fn(),
    onReset: vi.fn(),
  }
  return { props, ...render(<TransactionFilters {...props} />) }
}

describe("TransactionFilters", () => {
  afterEach(cleanup)

  it("emits search input", () => {
    const { props } = renderFilters()
    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: "Mercado" },
    })
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Mercado" })
    )
  })

  it("emits the start date", () => {
    const { props } = renderFilters()
    fireEvent.change(screen.getByLabelText("De"), {
      target: { value: "2026-09-01" },
    })
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-09-01" })
    )
  })

  it("emits the end date", () => {
    const { props } = renderFilters()
    fireEvent.change(screen.getByLabelText("Até"), {
      target: { value: "2026-09-30" },
    })
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ to: "2026-09-30" })
    )
  })

  it("emits selected transaction types", () => {
    const { props } = renderFilters()
    fireEvent.click(screen.getByRole("button", { name: "Receita" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ types: ["INCOME"] })
    )
  })

  it("selects Todos by default", () => {
    renderFilters()
    expect(
      screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")
    ).toBe("true")
  })

  it("emits all transaction types when Todos is selected", () => {
    const { props } = renderFilters()
    fireEvent.click(screen.getByRole("button", { name: "Todos" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ["INCOME", "EXPENSE", "TRANSFER"],
      })
    )
  })

  it("emits the selected account", () => {
    const { props } = renderFilters()
    fireEvent.change(screen.getByLabelText("Conta"), {
      target: { value: "account-1" },
    })
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ accountIds: ["account-1"] })
    )
  })

  it("emits the selected category", () => {
    const { props } = renderFilters()
    fireEvent.change(screen.getByLabelText("Categoria"), {
      target: { value: "category-1" },
    })
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ["category-1"] })
    )
  })

  it("keeps status local to loaded results", () => {
    const { props } = renderFilters()
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "CANCELLED" },
    })
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CANCELLED" })
    )
    expect(screen.getByRole("status").textContent).toContain(
      "somente os resultados carregados"
    )
  })

  it("preserves combined filter state", () => {
    render(
      <TransactionFilters
        filters={{
          ...emptyTransactionFilters,
          search: "Mercado",
          status: "EDITED",
        }}
        accounts={[]}
        categories={[]}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByLabelText("Buscar").getAttribute("value")).toBe(
      "Mercado"
    )
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe(
      "EDITED"
    )
  })

  it("resets every filter through the supplied action", () => {
    const { props } = renderFilters()
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(props.onReset).toHaveBeenCalledTimes(1)
  })

  it("keeps search keyboard accessible", () => {
    renderFilters()
    expect(screen.getByLabelText("Buscar").getAttribute("type")).toBe("search")
  })

  it("uses full-width controls below the small breakpoint", () => {
    renderFilters()
    expect(screen.getByLabelText("Buscar").className).toContain("w-full")
    expect(
      screen.getByRole("button", { name: "Limpar filtros" }).className
    ).toContain("w-full")
  })

  it("renders active-book account and category options", () => {
    renderFilters()
    expect(
      screen
        .getByRole("option", { name: "Conta corrente" })
        .getAttribute("value")
    ).toBe("account-1")
    expect(
      screen.getByRole("option", { name: "Mercado" }).getAttribute("value")
    ).toBe("category-1")
  })
})
