/* @vitest-environment jsdom */
import type { InvestmentAccountView } from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentAccountList } from "./investment-account-list"

const first: InvestmentAccountView = {
  id: "wallet-1",
  name: "Corretora A",
  currency: "BRL",
  status: "ACTIVE",
  institutionName: "Instituição A",
  displayReference: "Final 1234",
  defaultSettlementAccountId: "bank-1",
  ledgerBalanceMinor: "100000",
  positionCostMinor: "80000",
  cashMinor: "20000",
  marketValueMinor: "85000",
  unrealizedResultMinor: "5000",
}
const second: InvestmentAccountView = {
  ...first,
  id: "wallet-2",
  name: "Corretora B",
  institutionName: undefined,
  displayReference: undefined,
  ledgerBalanceMinor: "10000",
  positionCostMinor: "20000",
  cashMinor: "-10000",
  marketValueMinor: "22000",
  unrealizedResultMinor: "2000",
}
const archived: InvestmentAccountView = {
  ...first,
  id: "wallet-3",
  name: "Carteira antiga",
  status: "ARCHIVED",
  ledgerBalanceMinor: "0",
  positionCostMinor: "0",
  cashMinor: "0",
  marketValueMinor: "0",
  unrealizedResultMinor: "0",
}

function show(
  overrides: Partial<React.ComponentProps<typeof InvestmentAccountList>> = {}
) {
  const props = {
    accounts: [first] as readonly InvestmentAccountView[] | undefined,
    isPending: false,
    isError: false,
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    onSelect: vi.fn(),
    onConfigure: vi.fn(),
    onArchive: vi.fn(),
    onReactivate: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<InvestmentAccountList {...props} />) }
}

function openActions(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Ações de ${name}` }))
}

afterEach(cleanup)

describe("InvestmentAccountList", () => {
  it("shows ledger balance and allocated cost separately", () => {
    show()
    const card = within(screen.getByTestId("investment-account-wallet-1"))
    expect(card.getByText(/R\$\s*1\.000,00/)).toBeTruthy()
    expect(card.getByText(/R\$\s*800,00/)).toBeTruthy()
  })

  it("shows wallet cash, market value and unrealized result", () => {
    show()
    const card = within(screen.getByTestId("investment-account-wallet-1"))
    expect(card.getByText(/R\$\s*200,00/)).toBeTruthy()
    expect(card.getByText(/R\$\s*850,00/)).toBeTruthy()
    expect(card.getByText(/R\$\s*50,00/)).toBeTruthy()
  })

  it("shows institution, reference, currency and active status", () => {
    show()
    const card = within(screen.getByTestId("investment-account-wallet-1"))
    expect(card.getByText("Instituição A · Final 1234")).toBeTruthy()
    expect(card.getByText("Ativa")).toBeTruthy()
    expect(card.getAllByText(/R\$/)).toHaveLength(5)
  })

  it("keeps optional institution and settlement absent while using wallet currency", () => {
    show({
      accounts: [
        {
          ...second,
          cashMinor: "0",
          currency: "USD",
          defaultSettlementAccountId: undefined,
        },
      ],
    })
    const card = within(screen.getByTestId("investment-account-wallet-2"))
    expect(card.getByText("Instituição não informada")).toBeTruthy()
    expect(card.getByText("Sem conta padrão de liquidação")).toBeTruthy()
    expect(card.getByText(/US\$\s*100,00/)).toBeTruthy()
  })

  it("marks negative wallet cash even when the other wallet keeps the aggregate positive", () => {
    show({ accounts: [first, second] })
    const card = within(screen.getByTestId("investment-account-wallet-2"))
    expect(card.getByText(/-R\$\s*100,00/)).toBeTruthy()
    expect(
      card.getByText(/Saldo da carteira menor que o custo alocado/)
    ).toBeTruthy()
    expect(
      screen.getByText(/Valores calculados com inconsistências/)
    ).toBeTruthy()
  })

  it("removes negative cash warning after a corrected query result", () => {
    const view = show({ accounts: [second] })
    expect(
      screen.getByText(/Valores calculados com inconsistências/)
    ).toBeTruthy()
    view.rerender(
      <InvestmentAccountList
        {...view.props}
        accounts={[{ ...second, cashMinor: "0", positionCostMinor: "10000" }]}
      />
    )
    expect(
      screen.queryByText(/Valores calculados com inconsistências/)
    ).toBeNull()
    expect(
      screen.queryByText(/Saldo da carteira menor que o custo alocado/)
    ).toBeNull()
  })

  it("selects a wallet and marks the selected action", () => {
    const { props } = show({ selectedAccountId: "wallet-1" })
    const button = screen.getByRole("button", { name: "Carteira selecionada" })
    expect(button.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(button)
    expect(props.onSelect).toHaveBeenCalledWith("wallet-1")
  })

  it("dispatches configuration for an active wallet", () => {
    const { props } = show()
    openActions("Corretora A")
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Configurar carteira" })
    )
    expect(props.onConfigure).toHaveBeenCalledWith(first)
  })

  it("dispatches archive for a zero-ledger wallet, leaving the domain to verify open positions", () => {
    const zero = {
      ...first,
      ledgerBalanceMinor: "0",
      positionCostMinor: "0",
      cashMinor: "0",
    }
    const { props } = show({ accounts: [zero] })
    openActions("Corretora A")
    fireEvent.click(screen.getByRole("menuitem", { name: "Arquivar carteira" }))
    expect(props.onArchive).toHaveBeenCalledWith(zero)
  })

  it("dispatches archive with residual balance so the domain can explain the rejection", () => {
    const { props } = show()
    openActions("Corretora A")
    fireEvent.click(screen.getByRole("menuitem", { name: "Arquivar carteira" }))
    expect(props.onArchive).toHaveBeenCalledWith(first)
  })

  it("reactivates an archived wallet without exposing archive or configure", () => {
    const { props } = show({ accounts: [archived] })
    expect(screen.getByText("Arquivada")).toBeTruthy()
    openActions("Carteira antiga")
    expect(
      screen.queryByRole("menuitem", { name: "Arquivar carteira" })
    ).toBeNull()
    expect(
      screen.queryByRole("menuitem", { name: "Configurar carteira" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("menuitem", { name: "Reativar carteira" }))
    expect(props.onReactivate).toHaveBeenCalledWith(archived)
  })

  it("shows an action error without hiding computed values", () => {
    show({ actionError: "Carteira em uso por posição aberta." })
    expect(screen.getByText("Carteira em uso por posição aberta.")).toBeTruthy()
    expect(screen.getByText(/R\$\s*1\.000,00/)).toBeTruthy()
  })

  it("shows loading rather than fabricated zeros", () => {
    show({ accounts: undefined, isPending: true })
    expect(screen.getByLabelText("Carregando carteiras")).toBeTruthy()
    expect(screen.queryByText(/R\$\s*0,00/)).toBeNull()
  })

  it("shows load error and retry rather than fabricated zeros", () => {
    const { props } = show({ accounts: undefined, isError: true })
    expect(
      screen.getByText("Não foi possível carregar as carteiras")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/R\$\s*0,00/)).toBeNull()
  })

  it("keeps prior values visible after a refresh error", () => {
    show({ isError: true })
    expect(
      screen.getByText(/Dados anteriores; atualização das carteiras falhou/)
    ).toBeTruthy()
    expect(screen.getByText(/R\$\s*1\.000,00/)).toBeTruthy()
  })

  it("shows empty state and creates a wallet", () => {
    const { props } = show({ accounts: [] })
    expect(screen.getByText("Nenhuma carteira cadastrada.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar carteira" }))
    expect(props.onCreate).toHaveBeenCalledTimes(1)
  })

  it("blocks only the pending wallet action menu", () => {
    show({ accounts: [first, second], actionPendingId: "wallet-1" })
    expect(
      screen
        .getByRole("button", { name: "Ações de Corretora A" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Ações de Corretora B" })
        .hasAttribute("disabled")
    ).toBe(false)
  })
})
