/* @vitest-environment jsdom */
import type {
  InvestmentPositionView,
  InvestmentValuationHistoryItem,
} from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InvestmentValuationHistory } from "./investment-valuation-history"

const state = vi.hoisted(() => ({
  positionIds: [] as unknown[],
  query: null as unknown,
}))
vi.mock("../hooks", () => ({
  useInvestmentValuations: (positionId: unknown) => {
    state.positionIds.push(positionId)
    return state.query
  },
}))

const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB A",
  assetClass: "FIXED_INCOME",
  quantity: "10",
  bookCostMinor: "500000",
  currency: "BRL",
  status: "OPEN",
  version: 3,
  allocationRevision: 2,
  valuation: {
    basis: "VALUATION",
    currentValueMinor: "520000",
    valuationId: "valuation-2",
    valuedAt: "2026-09-20T10:00:00.000Z",
  },
}
const valuation: InvestmentValuationHistoryItem = {
  id: "valuation-2",
  valuedAt: "2026-09-20T10:00:00.000Z",
  recordedAt: "2026-09-21T12:34:00.000Z",
  recordSequence: "2",
  allocationRevision: 2,
  currency: "BRL",
  quantity: "10",
  unitPrice: "520.00",
  grossValueMinor: "520000",
  netValueMinor: "518000",
  withdrawableValueMinor: "300000",
}
const old: InvestmentValuationHistoryItem = {
  ...valuation,
  id: "valuation-1",
  valuedAt: "2026-08-01T00:00:00.000Z",
  recordedAt: "2026-09-22T11:00:00.000Z",
  recordSequence: "1",
  allocationRevision: 1,
  grossValueMinor: "120000",
  netValueMinor: undefined,
  withdrawableValueMinor: undefined,
  quantity: undefined,
  unitPrice: undefined,
}
const fetchNextPage = vi.fn()
const refetch = vi.fn()

function query(
  items: readonly InvestmentValuationHistoryItem[] | undefined,
  overrides: Record<string, unknown> = {}
) {
  state.query = {
    data: items === undefined ? undefined : { items },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage,
    refetch,
    ...overrides,
  }
}
function show(
  target: InvestmentPositionView | null = position,
  canRecord = true
) {
  const onRecord = vi.fn()
  return {
    onRecord,
    ...render(
      <InvestmentValuationHistory
        position={target ?? undefined}
        canRecord={canRecord}
        onRecord={onRecord}
      />
    ),
  }
}
beforeEach(() => {
  state.positionIds = []
  query([valuation, old])
  fetchNextPage.mockClear()
  refetch.mockClear()
})
afterEach(cleanup)

describe("InvestmentValuationHistory", () => {
  it("asks for a position before loading valuations", () => {
    show(null)
    expect(
      screen.getByText("Selecione uma posição para ver avaliações.")
    ).toBeTruthy()
    expect(state.positionIds.at(-1)).toBeUndefined()
  })

  it("shows current observation with valuation and registration dates", () => {
    show()
    const card = within(screen.getByTestId("valuation-valuation-2"))
    expect(card.getByText("Atual")).toBeTruthy()
    expect(card.getByText("Avaliação de 20/09/2026")).toBeTruthy()
    expect(card.getByText("Registrada em 21/09/2026, 12:34 UTC")).toBeTruthy()
  })

  it("keeps earlier observation historical even when recorded later", () => {
    show()
    const card = within(screen.getByTestId("valuation-valuation-1"))
    expect(card.getByText("Histórica")).toBeTruthy()
    expect(card.getByText("Avaliação de 01/08/2026")).toBeTruthy()
    expect(card.getByText("Registrada em 22/09/2026, 11:00 UTC")).toBeTruthy()
  })

  it("shows gross, net and withdrawable as distinct values", () => {
    show()
    const card = within(screen.getByTestId("valuation-valuation-2"))
    expect(card.getByText(/R\$\s*5\.200,00/)).toBeTruthy()
    expect(card.getByText(/R\$\s*5\.180,00/)).toBeTruthy()
    expect(card.getByText(/R\$\s*3\.000,00/)).toBeTruthy()
  })

  it("keeps absent optional amounts, quantity and price unknown", () => {
    show()
    const card = within(screen.getByTestId("valuation-valuation-1"))
    expect(card.getAllByText("Desconhecido")).toHaveLength(3)
    expect(card.getByText("Desconhecida")).toBeTruthy()
  })

  it("shows allocation revision independently from record sequence", () => {
    show()
    const current = within(screen.getByTestId("valuation-valuation-2"))
    const historical = within(screen.getByTestId("valuation-valuation-1"))
    expect(current.getByText("2")).toBeTruthy()
    expect(historical.getByText("1")).toBeTruthy()
  })

  it("does not promote an older allocation revision to current after fallback", () => {
    query([old])
    show({
      ...position,
      allocationRevision: 3,
      valuation: { basis: "BOOK_COST", currentValueMinor: "500000" },
    })
    expect(screen.getByText(/Sem avaliação atual; usando custo/)).toBeTruthy()
    expect(
      within(screen.getByTestId("valuation-valuation-1")).getByText("Histórica")
    ).toBeTruthy()
  })

  it("preserves evaluations after the position closes and shows consolidated zero", () => {
    show({
      ...position,
      status: "CLOSED",
      valuation: { basis: "CLOSED", currentValueMinor: "0" },
    })
    expect(
      screen.getByText(/Posição encerrada; avaliações preservadas/)
    ).toBeTruthy()
    expect(screen.getByText(/R\$\s*0,00/)).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Registrar nova avaliação" })
    ).toBeNull()
    expect(
      within(screen.getByTestId("valuation-valuation-2")).getByText("Histórica")
    ).toBeTruthy()
  })

  it("offers append-only registration for an active position", () => {
    const { onRecord } = show()
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar nova avaliação" })
    )
    expect(onRecord).toHaveBeenCalledWith(position)
    expect(screen.getByTestId("valuation-valuation-1")).toBeTruthy()
  })

  it("hides registration when the parent knows the position cannot be evaluated", () => {
    show(position, false)
    expect(
      screen.queryByRole("button", { name: "Registrar nova avaliação" })
    ).toBeNull()
  })

  it("retains older cards when a new observation is appended", () => {
    const view = show()
    query([
      { ...valuation, id: "valuation-3", recordSequence: "3" },
      valuation,
      old,
    ])
    view.rerender(
      <InvestmentValuationHistory
        position={position}
        canRecord
        onRecord={view.onRecord}
      />
    )
    expect(screen.getByTestId("valuation-valuation-3")).toBeTruthy()
    expect(screen.getByTestId("valuation-valuation-2")).toBeTruthy()
    expect(screen.getByTestId("valuation-valuation-1")).toBeTruthy()
  })

  it("fetches another valuation page only when the cursor exists", () => {
    query([valuation], { hasNextPage: true })
    show()
    fireEvent.click(
      screen.getByRole("button", { name: "Carregar mais avaliações" })
    )
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("blocks pagination while fetching", () => {
    query([valuation], { hasNextPage: true, isFetchingNextPage: true })
    show()
    expect(
      screen
        .getByRole("button", { name: "Carregando mais..." })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("shows loading without a false empty history", () => {
    query(undefined, { isPending: true })
    show()
    expect(screen.getByLabelText("Carregando avaliações")).toBeTruthy()
    expect(
      screen.queryByText("Nenhuma avaliação registrada nesta posição.")
    ).toBeNull()
  })

  it("shows error with retry without replacing history by empty", () => {
    query(undefined, { isError: true })
    show()
    expect(
      screen.getByText("Não foi possível carregar as avaliações")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("keeps prior observations after refresh error", () => {
    query([valuation], { isError: true })
    show()
    expect(
      screen.getByText(/Dados anteriores; atualização das avaliações falhou/)
    ).toBeTruthy()
    expect(screen.getByTestId("valuation-valuation-2")).toBeTruthy()
  })

  it("shows empty history without deleting the registration action", () => {
    query([])
    show()
    expect(
      screen.getByText("Nenhuma avaliação registrada nesta posição.")
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Registrar nova avaliação" })
    ).toBeTruthy()
  })
})
