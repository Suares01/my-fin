/* @vitest-environment jsdom */
import type {
  InvestmentAccountView,
  InvestmentInstrumentView,
  InvestmentPositionView,
} from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InvestmentPositionDetail } from "./investment-position-detail"

const state = vi.hoisted(() => ({
  position: undefined as unknown,
  positionPending: false,
  positionError: false,
  accounts: undefined as unknown,
  accountsError: false,
  instruments: undefined as unknown,
  instrumentsError: false,
  positionIds: [] as unknown[],
  operationRenders: 0,
  valuationRenders: 0,
  refetchPosition: vi.fn(),
  refetchAccounts: vi.fn(),
  refetchInstruments: vi.fn(),
}))

vi.mock("../hooks", () => ({
  useInvestmentPosition: (positionId: unknown) => {
    state.positionIds.push(positionId)
    return {
      data: state.position,
      isPending: state.positionPending,
      isError: state.positionError,
      refetch: state.refetchPosition,
    }
  },
  useInvestmentAccounts: () => ({
    data: state.accounts,
    isError: state.accountsError,
    refetch: state.refetchAccounts,
  }),
  useInvestmentInstruments: () => ({
    data: state.instruments,
    isError: state.instrumentsError,
    refetch: state.refetchInstruments,
  }),
}))
vi.mock("./investment-operation-history", () => ({
  InvestmentOperationHistory: ({
    positionId,
    canCorrect,
    onCorrect,
  }: {
    positionId: string
    canCorrect: boolean
    onCorrect: (operation: { id: string }) => void
  }) => {
    state.operationRenders++
    return (
      <div data-testid="operations-history">
        <span>{positionId}</span>
        <button
          disabled={!canCorrect}
          onClick={() => onCorrect({ id: "operation-1" })}
        >
          Corrigir operação
        </button>
      </div>
    )
  },
}))
vi.mock("./investment-valuation-history", () => ({
  InvestmentValuationHistory: ({
    position,
    canRecord,
    onRecord,
  }: {
    position: InvestmentPositionView
    canRecord: boolean
    onRecord: (position: InvestmentPositionView) => void
  }) => {
    state.valuationRenders++
    return (
      <div data-testid="valuations-history">
        <button disabled={!canRecord} onClick={() => onRecord(position)}>
          Nova avaliação
        </button>
      </div>
    )
  },
}))

const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB Banco A",
  assetClass: "FIXED_INCOME",
  label: "Reserva 2028",
  quantityMode: "UNITS",
  quantity: "10",
  bookCostMinor: "100000",
  currency: "BRL",
  status: "OPEN",
  openedOn: "2026-01-01",
  version: 2,
  allocationRevision: 1,
  fixedIncomeTerms: {
    rateKind: "PREFIXED",
    annualRate: "11.5",
    issueDate: "2026-01-01",
    gracePeriodDate: "2026-06-01",
    maturityDate: "2028-01-01",
  },
  valuation: {
    basis: "VALUATION",
    currentValueMinor: "120000",
    valuationId: "valuation-1",
    valuedAt: "2026-09-20",
    netValueMinor: "118000",
    withdrawableValueMinor: "90000",
  },
}
const account = {
  id: "wallet-1",
  name: "Corretora A",
  status: "ACTIVE",
} as InvestmentAccountView
const instrument = {
  id: "instrument-1",
  name: "CDB Banco A",
  status: "ACTIVE",
} as InvestmentInstrumentView

const onAction = vi.fn()
const onCorrect = vi.fn()
function show(positionId: string | null = "position-1") {
  return render(
    <InvestmentPositionDetail
      positionId={positionId ?? undefined}
      onAction={onAction}
      onCorrect={onCorrect}
    />
  )
}

beforeEach(() => {
  state.position = position
  state.positionPending = false
  state.positionError = false
  state.accounts = [account]
  state.accountsError = false
  state.instruments = [instrument]
  state.instrumentsError = false
  state.positionIds = []
  state.operationRenders = 0
  state.valuationRenders = 0
  vi.clearAllMocks()
})
afterEach(cleanup)

describe("InvestmentPositionDetail", () => {
  it("asks for a selected position before opening histories", () => {
    show(null)
    expect(
      screen.getByText("Selecione uma posição para ver os detalhes.")
    ).toBeTruthy()
    expect(state.operationRenders).toBe(0)
  })

  it("shows a loading state without fictitious balances", () => {
    state.position = undefined
    state.positionPending = true
    show()
    expect(screen.getByLabelText("Carregando detalhe da posição")).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it("retries a failed detail query", () => {
    state.position = undefined
    state.positionError = true
    show()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(state.refetchPosition).toHaveBeenCalledTimes(1)
  })

  it("does not open a missing or foreign-book position", () => {
    state.position = null
    show("foreign-position")
    expect(state.positionIds.at(-1)).toBe("foreign-position")
    expect(screen.getByText("Posição não encontrada neste livro.")).toBeTruthy()
    expect(state.operationRenders).toBe(0)
  })

  it("shows identity, wallet, class and open state", () => {
    show()
    expect(screen.getByText("CDB Banco A — Reserva 2028")).toBeTruthy()
    expect(screen.getByText("Corretora A")).toBeTruthy()
    expect(screen.getByText("Renda fixa")).toBeTruthy()
    expect(screen.getByText("Unidades")).toBeTruthy()
    expect(screen.getByText("Aberta")).toBeTruthy()
  })

  it("shows cost, current value, net and withdrawable separately", () => {
    show()
    const detail = within(
      screen.getByRole("region", { name: "Detalhe da posição" })
    )
    expect(detail.getByText(/R\$\s*1\.000,00/)).toBeTruthy()
    expect(detail.getByText(/R\$\s*1\.200,00/)).toBeTruthy()
    expect(detail.getByText(/R\$\s*1\.180,00/)).toBeTruthy()
    expect(detail.getByText(/R\$\s*900,00/)).toBeTruthy()
  })

  it("shows known fixed-income terms and dates", () => {
    show()
    expect(screen.getByText("Prefixada")).toBeTruthy()
    expect(screen.getByText("11.5%")).toBeTruthy()
    expect(screen.getByText("01/06/2026")).toBeTruthy()
    expect(screen.getByText("01/01/2028")).toBeTruthy()
    expect(
      screen.getByText(/termos da contratação não são alterados/)
    ).toBeTruthy()
  })

  it("keeps an overdue position open until an effective exit is recorded", () => {
    state.position = {
      ...position,
      fixedIncomeTerms: { maturityDate: "2020-01-01" },
    }
    show()
    expect(screen.getByText("01/01/2020")).toBeTruthy()
    expect(screen.getByText("Aberta")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Comprar ou aplicar" })
    ).toBeTruthy()
  })

  it("does not invent terms, quantity or optional valuation values", () => {
    state.position = {
      ...position,
      fixedIncomeTerms: undefined,
      quantity: undefined,
      valuation: { basis: "BOOK_COST", currentValueMinor: "100000" },
    }
    show()
    expect(
      screen.getByText("Nenhum termo adicional foi informado.")
    ).toBeTruthy()
    expect(screen.getByText("Desconhecida")).toBeTruthy()
    expect(screen.getAllByText("Desconhecido")).toHaveLength(2)
    expect(screen.getByText("Sem avaliação atual; usando custo")).toBeTruthy()
  })

  it("shows closed zero and close date without losing its histories", () => {
    state.position = {
      ...position,
      status: "CLOSED",
      closedOn: "2026-09-21",
      valuation: { basis: "CLOSED", currentValueMinor: "0" },
    }
    show()
    expect(screen.getByText("Encerrada")).toBeTruthy()
    expect(screen.getByText("21/09/2026")).toBeTruthy()
    expect(screen.getByText("Posição encerrada")).toBeTruthy()
    expect(screen.getByTestId("operations-history")).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Comprar ou aplicar" })
    ).toBeNull()
  })

  it("keeps income, fee and tax available on a closed active position", () => {
    state.position = { ...position, status: "CLOSED" }
    show()
    for (const name of [
      "Registrar rendimento",
      "Registrar tarifa",
      "Registrar imposto",
    ])
      expect(
        screen.getByRole("button", { name }).hasAttribute("disabled")
      ).toBe(false)
    expect(
      screen.queryByRole("button", { name: "Vender ou resgatar" })
    ).toBeNull()
  })

  it("dispatches a specialized purchase for the selected position", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Comprar ou aplicar" }))
    expect(onAction).toHaveBeenCalledWith("purchase", position)
  })

  it("dispatches the specialized sale and valuation actions", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Vender ou resgatar" }))
    fireEvent.click(screen.getByRole("button", { name: "Registrar avaliação" }))
    expect(onAction).toHaveBeenNthCalledWith(1, "sale", position)
    expect(onAction).toHaveBeenNthCalledWith(2, "valuation", position)
  })

  it("keeps operation and valuation queries in separate lazy tabs", () => {
    show()
    expect(state.operationRenders).toBeGreaterThan(0)
    expect(state.valuationRenders).toBe(0)
    fireEvent.click(screen.getByRole("tab", { name: "Avaliações" }))
    expect(screen.getByTestId("valuations-history")).toBeTruthy()
    expect(state.valuationRenders).toBeGreaterThan(0)
    expect(screen.queryByTestId("operations-history")).toBeNull()
  })

  it("dispatches correction from the active operations tab", () => {
    show()
    fireEvent.click(screen.getByRole("button", { name: "Corrigir operação" }))
    expect(onCorrect).toHaveBeenCalledWith({ id: "operation-1" }, position)
  })

  it("blocks actions and correction when the wallet is archived", () => {
    state.accounts = [{ ...account, status: "ARCHIVED" }]
    show()
    expect(screen.getByText(/Reative a carteira e o instrumento/)).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Registrar rendimento" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Corrigir operação" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("blocks actions when the instrument is archived", () => {
    state.instruments = [{ ...instrument, status: "ARCHIVED" }]
    show()
    expect(screen.getByText("Cadastro arquivado")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Registrar avaliação" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("retries catalog errors instead of enabling unsafe operations", () => {
    state.accounts = undefined
    state.accountsError = true
    show()
    expect(
      screen
        .getByRole("button", { name: "Comprar ou aplicar" })
        .hasAttribute("disabled")
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(state.refetchAccounts).toHaveBeenCalledTimes(1)
    expect(state.refetchInstruments).toHaveBeenCalledTimes(1)
  })

  it("keeps stale detail visible with a retry after refresh failure", () => {
    state.positionError = true
    show()
    expect(screen.getByText("CDB Banco A — Reserva 2028")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(state.refetchPosition).toHaveBeenCalledTimes(1)
  })
})
