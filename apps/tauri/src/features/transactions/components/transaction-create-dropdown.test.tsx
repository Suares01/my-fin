/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TransactionCreateDropdown } from "./transaction-create-dropdown.js"

describe("TransactionCreateDropdown", () => {
  afterEach(cleanup)

  it("offers exactly the three creation types", () => {
    render(<TransactionCreateDropdown onCreate={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Criar transação" }))

    expect(
      ["Receita", "Despesa", "Transferência"].map((name) =>
        screen.getByRole("menuitem", { name })
      )
    ).toHaveLength(3)
  })

  it.each([
    ["Receita", "INCOME"],
    ["Despesa", "EXPENSE"],
    ["Transferência", "TRANSFER"],
  ] as const)("emits %s as %s", (label, type) => {
    const onCreate = vi.fn()
    render(<TransactionCreateDropdown onCreate={onCreate} />)

    fireEvent.click(screen.getByRole("button", { name: "Criar transação" }))
    fireEvent.click(screen.getByRole("menuitem", { name: label }))

    expect(onCreate).toHaveBeenCalledWith(type)
  })
})
