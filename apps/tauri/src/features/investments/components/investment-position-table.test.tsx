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
import { InvestmentPositionTable } from "./investment-position-table"

const state = vi.hoisted(() => ({
  filters: [] as unknown[],
  query: null as unknown,
}))
vi.mock("../hooks", () => ({
  useInvestmentPositions: (filters: unknown) => {
    state.filters.push(filters)
    return state.query
  },
}))

const account: InvestmentAccountView = {
  id: "wallet-1",
  name: "Corretora A",
  currency: "BRL",
  status: "ACTIVE",
  ledgerBalanceMinor: "100000",
  positionCostMinor: "80000",
  cashMinor: "20000",
  marketValueMinor: "85000",
  unrealizedResultMinor: "5000",
}
const instrument: InvestmentInstrumentView = {
  id: "instrument-1",
  name: "CDB A",
  type: "CDB",
  currency: "BRL",
  status: "ACTIVE",
  identifiers: [],
}
const position: InvestmentPositionView = {
  id: "position-1",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  instrumentName: "CDB A",
  assetClass: "FIXED_INCOME",
  label: "Reserva 2028",
  quantity: "10",
  bookCostMinor: "500000",
  currency: "BRL",
  status: "OPEN",
  version: 1,
  allocationRevision: 1,
  valuation: {
    basis: "VALUATION",
    currentValueMinor: "520000",
    valuedAt: "2026-09-20T10:00:00Z",
    netValueMinor: "518000",
    withdrawableValueMinor: "300000",
  },
}
const fetchNextPage = vi.fn()
const refetch = vi.fn()

function query(
  items: readonly InvestmentPositionView[] | undefined,
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
  overrides: Partial<React.ComponentProps<typeof InvestmentPositionTable>> = {}
) {
  const props = {
    accounts: [account],
    instruments: [instrument],
    onCreate: vi.fn(),
    onView: vi.fn(),
    onPurchase: vi.fn(),
    onSale: vi.fn(),
    onEvaluate: vi.fn(),
    onConfigure: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<InvestmentPositionTable {...props} />) }
}

function selectOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }))
  const element = screen.getByRole("option", { name: option })
  fireEvent.pointerDown(element)
  fireEvent.click(element)
}

function openActions(name = "CDB A — Reserva 2028") {
  fireEvent.click(
    screen.getByRole("button", { name: `Ações da posição ${name}` })
  )
}

beforeEach(() => {
  state.filters = []
  query([position])
  fetchNextPage.mockClear()
  refetch.mockClear()
})
afterEach(cleanup)

describe("InvestmentPositionTable", () => {
  it("shows instrument, label, account, class and status", () => {
    show()
    const row = within(screen.getByTestId("position-position-1"))
    expect(row.getByText("CDB A")).toBeTruthy()
    expect(row.getByText("Reserva 2028")).toBeTruthy()
    expect(row.getByText("Corretora A")).toBeTruthy()
    expect(row.getByText("Renda fixa")).toBeTruthy()
    expect(row.getByText("Aberta")).toBeTruthy()
  })

  it("shows known quantity, cost, gross value and valuation date", () => {
    show()
    const row = within(screen.getByTestId("position-position-1"))
    expect(row.getByText("10")).toBeTruthy()
    expect(row.getByText(/R\$\s*5\.000,00/)).toBeTruthy()
    expect(row.getByText(/R\$\s*5\.200,00/)).toBeTruthy()
    expect(row.getByText("Avaliação de 20/09/2026")).toBeTruthy()
  })

  it("shows distinct optional net and withdrawable valuations", () => {
    show()
    const row = within(screen.getByTestId("position-position-1"))
    expect(row.getByText(/Líquido: R\$\s*5\.180,00/)).toBeTruthy()
    expect(row.getByText(/resgatável: R\$\s*3\.000,00/)).toBeTruthy()
  })

  it("leaves absent quantity and optional valuations unknown", () => {
    query([
      {
        ...position,
        quantity: undefined,
        valuation: {
          basis: "VALUATION",
          currentValueMinor: "520000",
          valuedAt: "2026-09-20T10:00:00Z",
        },
      },
    ])
    show()
    const row = within(screen.getByTestId("position-position-1"))
    expect(row.getByText("Desconhecida")).toBeTruthy()
    expect(row.getByText(/Líquido: desconhecido/)).toBeTruthy()
    expect(row.getByText(/resgatável: desconhecido/)).toBeTruthy()
  })

  it("labels book-cost fallback rather than old quoted value", () => {
    query([
      {
        ...position,
        valuation: { basis: "BOOK_COST", currentValueMinor: "500000" },
      },
    ])
    show()
    const row = within(screen.getByTestId("position-position-1"))
    expect(row.getByText("Sem avaliação atual; usando custo")).toBeTruthy()
    expect(row.getAllByText(/R\$\s*5\.000,00/)).toHaveLength(2)
  })

  it("shows a closed position as zero while keeping its row and history action", () => {
    query([
      {
        ...position,
        status: "CLOSED",
        bookCostMinor: "0",
        valuation: { basis: "CLOSED", currentValueMinor: "0" },
      },
    ])
    show()
    const row = within(screen.getByTestId("position-position-1"))
    expect(row.getByText("Encerrada")).toBeTruthy()
    expect(row.getByText("Posição encerrada")).toBeTruthy()
    expect(row.getAllByText(/R\$\s*0,00/)).toHaveLength(2)
    openActions()
    expect(screen.getByRole("menuitem", { name: "Ver detalhes" })).toBeTruthy()
    expect(
      screen.queryByRole("menuitem", { name: "Comprar ou aplicar" })
    ).toBeNull()
  })

  it("keeps positions with the same instrument as distinct rows", () => {
    query([position, { ...position, id: "position-2", label: "Reserva 2030" }])
    show()
    expect(screen.getByTestId("position-position-1")).toBeTruthy()
    expect(screen.getByTestId("position-position-2")).toBeTruthy()
    expect(
      screen.getByRole("button", {
        name: "Ações da posição CDB A — Reserva 2028",
      })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", {
        name: "Ações da posição CDB A — Reserva 2030",
      })
    ).toBeTruthy()
  })

  it("filters by wallet through the read-model hook", () => {
    show({
      accounts: [account, { ...account, id: "wallet-2", name: "Corretora B" }],
    })
    selectOption("Carteira", "Corretora B")
    expect(state.filters.at(-1)).toMatchObject({ accountId: "wallet-2" })
  })

  it("filters by asset class through the read-model hook", () => {
    show()
    selectOption("Classe", "Ações")
    expect(state.filters.at(-1)).toMatchObject({ assetClass: "EQUITY" })
  })

  it("requests all statuses by default", () => {
    show()
    expect(state.filters.at(-1)).toMatchObject({ status: "ALL" })
  })

  it("filters by open or closed status through the read-model hook", () => {
    show()
    selectOption("Estado", "Encerradas")
    expect(state.filters.at(-1)).toMatchObject({ status: "CLOSED" })
  })

  it("passes name or label search to the paginated hook", () => {
    show()
    fireEvent.change(screen.getByRole("textbox", { name: "Nome ou rótulo" }), {
      target: { value: "Reserva" },
    })
    expect(state.filters.at(-1)).toMatchObject({ search: "Reserva" })
  })

  it("fetches only the next page when the cursor exists", () => {
    query([position], { hasNextPage: true })
    show()
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("disables next-page action while fetching", () => {
    query([position], { hasNextPage: true, isFetchingNextPage: true })
    show()
    expect(
      screen
        .getByRole("button", { name: "Carregando mais..." })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("opens active position actions through the dropdown", () => {
    const { props } = show()
    openActions()
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Comprar ou aplicar" })
    )
    expect(props.onPurchase).toHaveBeenCalledWith(position)
  })

  it("offers sale, valuation and metadata actions for an active position", () => {
    show()
    openActions()
    expect(
      screen.getByRole("menuitem", { name: "Vender ou resgatar" })
    ).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Avaliar" })).toBeTruthy()
    expect(
      screen.getByRole("menuitem", { name: "Configurar posição" })
    ).toBeTruthy()
  })

  it("hides trade actions when the wallet is archived", () => {
    show({ accounts: [{ ...account, status: "ARCHIVED" }] })
    openActions()
    expect(
      screen.queryByRole("menuitem", { name: "Comprar ou aplicar" })
    ).toBeNull()
  })

  it("hides trade actions when the instrument is archived", () => {
    show({ instruments: [{ ...instrument, status: "ARCHIVED" }] })
    openActions()
    expect(
      screen.queryByRole("menuitem", { name: "Comprar ou aplicar" })
    ).toBeNull()
  })

  it("shows loading without an empty-list claim", () => {
    query(undefined, { isPending: true })
    show()
    expect(screen.getByLabelText("Carregando posições")).toBeTruthy()
    expect(screen.queryByText("Nenhuma posição cadastrada.")).toBeNull()
  })

  it("shows an error with retry without claiming an empty list", () => {
    query(undefined, { isError: true })
    show()
    expect(
      screen.getByText("Não foi possível carregar as posições")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("retains previous rows after refresh error", () => {
    query([position], { isError: true })
    show()
    expect(
      screen.getByText(/Dados anteriores; atualização das posições falhou/)
    ).toBeTruthy()
    expect(screen.getByTestId("position-position-1")).toBeTruthy()
  })

  it("shows a create action for an unfiltered empty list", () => {
    query([])
    const { props } = show()
    fireEvent.click(screen.getByRole("button", { name: "Abrir posição" }))
    expect(props.onCreate).toHaveBeenCalledTimes(1)
  })

  it("clears a filtered empty result without creating a position", () => {
    query([])
    const { props } = show()
    fireEvent.change(screen.getByRole("textbox", { name: "Nome ou rótulo" }), {
      target: { value: "Inexistente" },
    })
    expect(
      screen.getByText("Nenhuma posição corresponde aos filtros.")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    expect(state.filters.at(-1)).toMatchObject({ search: "" })
    expect(props.onCreate).not.toHaveBeenCalled()
  })

  it("confines horizontal overflow to the table container", () => {
    show()
    const table = screen.getByRole("table")
    expect(table.parentElement?.getAttribute("data-slot")).toBe(
      "table-container"
    )
    expect(table.className).toContain("min-w-240")
  })
})
