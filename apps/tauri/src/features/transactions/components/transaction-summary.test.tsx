/* @vitest-environment jsdom */
import type { JournalChainListItem } from "@workspace/application"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TransactionSummary } from "./transaction-summary.js"

function chain(
  overrides: Partial<JournalChainListItem> = {}
): JournalChainListItem {
  return {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    presentedVersion: 1,
    type: "INCOME",
    status: "ACTIVE",
    occurredOn: "2026-09-03",
    recordedAt: "2026-09-03T12:00:00.000Z",
    sequence: "1",
    description: "Receita",
    origin: "MANUAL",
    amountMinor: "10000",
    currency: "BRL",
    financialAccounts: [],
    categories: [],
    ...overrides,
  }
}

describe("TransactionSummary", () => {
  afterEach(cleanup)

  it("renders the four loaded-results cards", () => {
    render(<TransactionSummary items={[chain()]} />)

    expect(screen.getByText("Receitas")).toBeTruthy()
    expect(screen.getByText("Despesas")).toBeTruthy()
    expect(screen.getByText("Maior valor")).toBeTruthy()
    expect(screen.getByText("Transações")).toBeTruthy()
    expect(screen.getAllByText("resultados carregados")).toHaveLength(4)
  })

  it("does not invent a currency for empty loaded results", () => {
    render(<TransactionSummary items={[]} />)

    expect(screen.getAllByText("—")).toHaveLength(3)
    expect(screen.getByText("0 itens")).toBeTruthy()
  })

  it("shows locally loaded income with a positive sign", () => {
    render(<TransactionSummary items={[chain({ amountMinor: "12345" })]} />)

    expect(screen.getByTestId("transaction-summary-income-BRL").textContent).toBe(
      "+R$ 123,45"
    )
  })

  it("shows locally loaded expense with a negative sign", () => {
    render(
      <TransactionSummary
        items={[chain({ type: "EXPENSE", amountMinor: "12345" })]}
      />
    )

    expect(screen.getByTestId("transaction-summary-expense-BRL").textContent).toBe(
      "-R$ 123,45"
    )
  })

  it("keeps transfers neutral in totals while counting them and selecting their magnitude", () => {
    render(
      <TransactionSummary
        items={[chain({ type: "TRANSFER", amountMinor: "90000" })]}
      />
    )

    expect(screen.queryByTestId("transaction-summary-income-BRL")).toBeNull()
    expect(screen.queryByTestId("transaction-summary-expense-BRL")).toBeNull()
    expect(screen.getByTestId("transaction-summary-largest").textContent).toBe(
      "R$ 900,00"
    )
    expect(screen.getByTestId("transaction-summary-count").textContent).toBe(
      "1 item"
    )
  })

  it("preserves currencies by showing each loaded currency separately", () => {
    render(
      <TransactionSummary
        items={[
          chain({ amountMinor: "10000", currency: "BRL" }),
          chain({ chainId: "chain-2", amountMinor: "20000", currency: "USD" }),
        ]}
      />
    )

    expect(screen.getByTestId("transaction-summary-income-BRL").textContent).toBe(
      "+R$ 100,00"
    )
    expect(screen.getByTestId("transaction-summary-income-USD").textContent).toBe(
      "+US$ 200,00"
    )
  })

  it("keeps large loaded integer values exact", () => {
    render(
      <TransactionSummary
        items={[chain({ amountMinor: "9007199254740993" })]}
      />
    )

    expect(screen.getByTestId("transaction-summary-income-BRL").textContent).toBe(
      "+R$ 90.071.992.547.409,93"
    )
  })
})
