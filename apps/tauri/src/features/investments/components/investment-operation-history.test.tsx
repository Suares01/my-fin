/* @vitest-environment jsdom */
import type { InvestmentOperationHistoryItem } from "@workspace/application"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InvestmentOperationHistory } from "./investment-operation-history"

const state = vi.hoisted(() => ({
  positionIds: [] as unknown[],
  query: null as unknown,
}))
vi.mock("../hooks", () => ({
  useInvestmentOperations: (positionId: unknown) => {
    state.positionIds.push(positionId)
    return state.query
  },
}))

const operation: InvestmentOperationHistoryItem = {
  id: "operation-1",
  type: "SALE",
  role: "BUSINESS",
  version: 2,
  occurredOn: "2026-09-01",
  recordedAt: "2026-09-27T12:34:00.000Z",
  sequence: "9",
  description: "Venda total",
  currency: "BRL",
  quantityDelta: "-10",
  grossAmountMinor: "120000",
  netCashFlowMinor: "118000",
  bookCostDeltaMinor: "-100000",
  feesMinor: "1000",
  taxesMinor: "1000",
  cashMode: "EXTERNAL_ACCOUNT",
  settlementAccountId: "bank-1",
  beforeKind: "EXISTING",
  beforeQuantity: "10",
  beforeBookCostMinor: "100000",
  beforeStatus: "OPEN",
  beforeOpenedOn: "2026-01-01",
  journalEntryId: "journal-1",
}
const fetchNextPage = vi.fn()
const refetch = vi.fn()

function query(
  items: readonly InvestmentOperationHistoryItem[] | undefined,
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
function show(positionId: string | null = "position-1") {
  const onCorrect = vi.fn()
  return {
    onCorrect,
    ...render(
      <InvestmentOperationHistory
        positionId={positionId ?? undefined}
        onCorrect={onCorrect}
      />
    ),
  }
}
function openActions(id = "operation-1") {
  fireEvent.click(
    screen.getByRole("button", { name: `Ações da operação ${id}` })
  )
}

beforeEach(() => {
  state.positionIds = []
  query([operation])
  fetchNextPage.mockClear()
  refetch.mockClear()
})
afterEach(cleanup)

describe("InvestmentOperationHistory", () => {
  it("asks for a position before showing history", () => {
    show(null)
    expect(
      screen.getByText("Selecione uma posição para ver operações.")
    ).toBeTruthy()
    expect(state.positionIds.at(-1)).toBeUndefined()
  })

  it("shows business fact, description and separate occurrence and recording dates", () => {
    show()
    const card = within(screen.getByTestId("operation-operation-1"))
    expect(card.getByText("Venda")).toBeTruthy()
    expect(card.getByText("Venda total")).toBeTruthy()
    expect(card.getByText("Efetiva")).toBeTruthy()
    expect(card.getByText("01/09/2026")).toBeTruthy()
    expect(card.getByText("27/09/2026, 12:34 UTC")).toBeTruthy()
  })

  it("shows signed persisted effects without recalculating them", () => {
    show()
    const card = within(screen.getByTestId("operation-operation-1"))
    expect(card.getByText("-10")).toBeTruthy()
    expect(card.getByText(/R\$\s*1\.200,00/)).toBeTruthy()
    expect(card.getByText(/R\$\s*1\.180,00/)).toBeTruthy()
    expect(card.getByText(/-R\$\s*1\.000,00/)).toBeTruthy()
  })

  it("shows fees, taxes and external settlement route", () => {
    show()
    const card = within(screen.getByTestId("operation-operation-1"))
    expect(card.getAllByText(/R\$\s*10,00/)).toHaveLength(2)
    expect(card.getByText("Conta externa bank-1")).toBeTruthy()
  })

  it("shows optional journal and before-state information", () => {
    show()
    const card = within(screen.getByTestId("operation-operation-1"))
    expect(card.getByText("journal-1")).toBeTruthy()
    expect(card.getByText("Aberta")).toBeTruthy()
  })

  it("keeps an operation without journal or settlement explicitly visible", () => {
    query([
      {
        ...operation,
        journalEntryId: undefined,
        cashMode: "INTERNAL_CASH",
        settlementAccountId: undefined,
        settledOn: undefined,
      },
    ])
    show()
    const card = within(screen.getByTestId("operation-operation-1"))
    expect(card.getByText("Sem lançamento contábil")).toBeTruthy()
    expect(card.getByText("Caixa da carteira")).toBeTruthy()
    expect(card.getByText("Não informada")).toBeTruthy()
  })

  it("shows original, reversal and replacement lineage without collapsing records", () => {
    const original = {
      ...operation,
      reversedBy: "reversal-1",
      replacedBy: "replacement-1",
    }
    const reversal: InvestmentOperationHistoryItem = {
      ...operation,
      id: "reversal-1",
      role: "REVERSAL",
      reversalOf: "operation-1",
      journalEntryId: "journal-reversal",
      netCashFlowMinor: "-118000",
    }
    const replacement = {
      ...operation,
      id: "replacement-1",
      replacementOf: "operation-1",
      recordedAt: "2026-09-28T08:00:00.000Z",
    }
    query([replacement, reversal, original])
    show()
    expect(screen.getByTestId("operation-operation-1")).toBeTruthy()
    expect(screen.getByTestId("operation-reversal-1")).toBeTruthy()
    expect(screen.getByTestId("operation-replacement-1")).toBeTruthy()
    expect(screen.getByText("Reverte: operation-1")).toBeTruthy()
    expect(screen.getByText("Substitui: operation-1")).toBeTruthy()
    expect(screen.getByText("Substituída por: replacement-1")).toBeTruthy()
  })

  it("shows original without artificial journal when only replacement has one", () => {
    query([
      {
        ...operation,
        id: "replacement-1",
        replacementOf: "operation-1",
        journalEntryId: "journal-new",
      },
      { ...operation, replacedBy: "replacement-1", journalEntryId: undefined },
    ])
    show()
    expect(
      within(screen.getByTestId("operation-operation-1")).getByText(
        "Sem lançamento contábil"
      )
    ).toBeTruthy()
    expect(
      within(screen.getByTestId("operation-replacement-1")).getByText(
        "journal-new"
      )
    ).toBeTruthy()
  })

  it("shows original journal without inventing one for replacement", () => {
    query([
      {
        ...operation,
        id: "replacement-1",
        replacementOf: "operation-1",
        journalEntryId: undefined,
      },
      { ...operation, replacedBy: "replacement-1" },
    ])
    show()
    expect(
      within(screen.getByTestId("operation-operation-1")).getByText("journal-1")
    ).toBeTruthy()
    expect(
      within(screen.getByTestId("operation-replacement-1")).getByText(
        "Sem lançamento contábil"
      )
    ).toBeTruthy()
  })

  it("offers correction only for the latest effective business operation", () => {
    const older = {
      ...operation,
      id: "operation-old",
      occurredOn: "2026-08-01",
    }
    query([operation, older])
    const { onCorrect } = show()
    expect(
      screen.queryByRole("button", { name: "Ações da operação operation-old" })
    ).toBeNull()
    openActions()
    fireEvent.click(screen.getByRole("menuitem", { name: "Corrigir operação" }))
    expect(onCorrect).toHaveBeenCalledWith(operation)
  })

  it("does not offer correction for reversed or replaced records", () => {
    query([
      { ...operation, id: "replacement-1", replacementOf: "operation-1" },
      {
        ...operation,
        id: "reversal-1",
        role: "REVERSAL",
        reversalOf: "operation-1",
      },
      { ...operation, replacedBy: "replacement-1", reversedBy: "reversal-1" },
    ])
    show()
    expect(
      screen.queryByRole("button", { name: "Ações da operação operation-1" })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Ações da operação reversal-1" })
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: "Ações da operação replacement-1" })
    ).toBeTruthy()
  })

  it("requests another page only when the operation cursor exists", () => {
    query([operation], { hasNextPage: true })
    show()
    fireEvent.click(
      screen.getByRole("button", { name: "Carregar mais operações" })
    )
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("blocks another page while fetching", () => {
    query([operation], { hasNextPage: true, isFetchingNextPage: true })
    show()
    expect(
      screen
        .getByRole("button", { name: "Carregando mais..." })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("shows loading without claiming an empty history", () => {
    query(undefined, { isPending: true })
    show()
    expect(screen.getByLabelText("Carregando operações")).toBeTruthy()
    expect(
      screen.queryByText("Nenhuma operação registrada nesta posição.")
    ).toBeNull()
  })

  it("shows error with retry without replacing history by empty", () => {
    query(undefined, { isError: true })
    show()
    expect(
      screen.getByText("Não foi possível carregar as operações")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("keeps prior facts on refresh error", () => {
    query([operation], { isError: true })
    show()
    expect(
      screen.getByText(/Dados anteriores; atualização das operações falhou/)
    ).toBeTruthy()
    expect(screen.getByTestId("operation-operation-1")).toBeTruthy()
  })

  it("shows an empty state when the selected position has no operations", () => {
    query([])
    show()
    expect(
      screen.getByText("Nenhuma operação registrada nesta posição.")
    ).toBeTruthy()
  })
})
