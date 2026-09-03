/* @vitest-environment jsdom */

import type { AccountBalanceItemView } from "@workspace/application"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccountsPage, filterAccounts } from "./accounts-page"
import type { FinancialAccountBalance } from "./account-card"
import { summarizeAccounts } from "./account-summary"

const state = vi.hoisted(() => ({
  session: { status: "ACTIVE", bookId: "book-1" } as const,
  mutateAsync: vi.fn(),
}))

const hooks = vi.hoisted(() => ({
  useAccountBalances: vi.fn(),
  useCreateAccount: vi.fn(() => ({
    mutateAsync: state.mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  })),
}))

vi.mock("../../../providers", () => ({
  useActiveBook: () => ({ session: state.session }),
}))

vi.mock("../hooks", () => ({
  useAccountBalances: hooks.useAccountBalances,
  useCreateAccount: hooks.useCreateAccount,
}))

const accounts: readonly FinancialAccountBalance[] = [
  {
    accountId: "asset-1",
    accountName: "Carteira",
    accountKind: "ASSET",
    rawBalanceMinor: "120000",
    displayBalanceMinor: "120000",
    amountMinor: "120000",
    currency: "BRL",
    asOf: null,
    archived: false,
  },
  {
    accountId: "liability-1",
    accountName: "Cartão",
    accountKind: "LIABILITY",
    rawBalanceMinor: "30000",
    displayBalanceMinor: "30000",
    amountMinor: "30000",
    currency: "BRL",
    asOf: null,
    archived: false,
  },
]

describe("AccountsPage", () => {
  it("derives its summary from asset and liability balances", () => {
    expect(summarizeAccounts(accounts)).toEqual({
      assetsMinor: "120000",
      liabilitiesMinor: "30000",
      netWorthMinor: "90000",
      currency: "BRL",
    })
  })

  it("filters financial accounts by type", () => {
    expect(filterAccounts(accounts, "ASSET")).toEqual([accounts[0]])
    expect(filterAccounts(accounts, "LIABILITY")).toEqual([accounts[1]])
    expect(filterAccounts(accounts, "ALL")).toEqual(accounts)

    const category: AccountBalanceItemView = {
      ...accounts[0],
      accountId: "income-1",
      accountKind: "INCOME",
    }
    expect(filterAccounts([...accounts, category], "ALL")).toEqual(accounts)
  })

  it("keeps the creation CTA available for an empty filter and opens its drawer", async () => {
    state.mutateAsync.mockResolvedValue({ id: "account-1" })
    hooks.useAccountBalances.mockReturnValue({
      isPending: false,
      isError: false,
      data: [accounts[0]],
    })

    render(<AccountsPage />)

    fireEvent.click(screen.getByRole("button", { name: "Ativos" }))
    expect(screen.getByText("Carteira")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Passivos" }))
    expect(
      screen.getByText("Nenhuma conta de passivo foi encontrada.")
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Adicionar conta/i }))
    expect(screen.getByRole("dialog").textContent).toContain("Adicionar conta")
    expect(screen.getByLabelText("Nome da conta")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Reserva" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(screen.getByRole("button", { name: /Adicionar conta/i }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(screen.getByRole("button", { name: /Adicionar conta/i }))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
