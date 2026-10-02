/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import type { JournalChainDetail } from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { TransactionRowDetails } from "./transaction-row-details.js"

const mockDetail = vi.fn()
vi.mock("../hooks/use-transaction-chain-detail.js", () => ({
  useTransactionChainDetail: () => mockDetail(),
}))

const detail = {
  chainId: "chain-1",
  presentedEntryId: "entry-1",
  presentedVersion: 1,
  type: "INCOME",
  status: "ACTIVE",
  occurredOn: "2026-09-03",
  recordedAt: "2026-09-03T12:00:00.000Z",
  sequence: "1",
  description: "Salário",
  origin: "MANUAL",
  canEditWithGenericFlow: true,
  amountMinor: "10000",
  currency: "BRL",
  financialAccounts: [{ id: "account-1", name: "Banco" }],
  categories: [{ id: "category-1", name: "Trabalho" }],
  postings: [],
  history: [
    {
      entryId: "entry-0",
      role: "ORIGINAL",
      description: "Salário",
      occurredOn: "2026-09-03",
      recordedAt: "2026-09-03T12:00:00.000Z",
      sequence: "1",
      postings: [],
    },
  ],
} as unknown as JournalChainDetail

function renderDetails(status: "ACTIVE" | "EDITED" | "CANCELLED" = "ACTIVE") {
  const props = {
    chainId: "chain-1",
    presentedEntryId: "entry-1",
    status,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  return {
    props,
    ...render(
      <MemoryRouter>
        <TransactionRowDetails {...props} />
      </MemoryRouter>
    ),
  }
}

describe("TransactionRowDetails", () => {
  afterEach(cleanup)
  const investmentDetail = {
    ...detail,
    type: "INVESTMENT",
    canEditWithGenericFlow: false,
    currency: "USD",
    amountMinor: "2500",
    investment: {
      operationId: "operation-1",
      positionId: "position-1",
      operationType: "REDEMPTION",
      netCashFlowMinor: "-2500",
      grossAmountMinor: "3000",
      bookCostDeltaMinor: "-2000",
    },
    categories: [
      { id: "income", name: "Ganho", kind: "INCOME" },
      { id: "expense", name: "Taxa", kind: "EXPENSE" },
    ],
    postings: [
      {
        id: "p1",
        account: { id: "income", name: "Ganho", kind: "INCOME" },
        amountMinor: "-1000",
        currency: "USD",
        position: 0,
      },
      {
        id: "p2",
        account: { id: "expense", name: "Taxa", kind: "EXPENSE" },
        amountMinor: "500",
        currency: "USD",
        position: 1,
      },
    ],
  } as JournalChainDetail

  it("shows operation type and exact investment amounts", () => {
    mockDetail.mockReturnValue({ data: investmentDetail })
    renderDetails()
    expect(
      screen.getByLabelText("Operação de investimento").textContent
    ).toContain("Operação: Resgate")
    expect(screen.getByText(/US\$\s*30,00/)).toBeTruthy()
    expect(screen.getByText(/US\$\s*20,00/)).toBeTruthy()
    expect(screen.getByText(/-US\$\s*25,00/)).toBeTruthy()
  })

  it("shows both income and expense postings in a mixed investment", () => {
    mockDetail.mockReturnValue({ data: investmentDetail })
    renderDetails()
    expect(screen.getByText(/Receita: Ganho/)).toBeTruthy()
    expect(screen.getByText(/Despesa: Taxa/)).toBeTruthy()
    const categories = within(
      screen.getByLabelText("Receitas e despesas da operação")
    )
    expect(categories.getByText(/US\$\s*10,00/).textContent).toBe("US$ 10,00")
    expect(categories.getByText(/US\$\s*5,00/).textContent).toBe("US$ 5,00")
  })

  it("shows a redemption gain of 80 after income 100 and tax 20", () => {
    mockDetail.mockReturnValue({
      data: {
        ...investmentDetail,
        currency: "BRL",
        investment: {
          ...investmentDetail.investment,
          grossAmountMinor: "510000",
          bookCostDeltaMinor: "-500000",
          netCashFlowMinor: "508000",
        },
        postings: [
          {
            id: "gain",
            account: { id: "income", name: "Ganho", kind: "INCOME" },
            amountMinor: "-10000",
            currency: "BRL",
            position: 0,
          },
          {
            id: "tax",
            account: { id: "tax", name: "Imposto", kind: "EXPENSE" },
            amountMinor: "2000",
            currency: "BRL",
            position: 1,
          },
        ],
      } as JournalChainDetail,
    })
    renderDetails()

    expect(
      screen.getByLabelText("Receitas e despesas da operação").textContent
    ).toMatch(/Receita: Ganho R\$\s*100,00/)
    expect(
      screen.getByLabelText("Receitas e despesas da operação").textContent
    ).toMatch(/Despesa: Imposto R\$\s*20,00/)
    expect(
      screen.getByText("Resultado líquido:").parentElement?.textContent
    ).toMatch(/Resultado líquido: R\$\s*80,00/)
  })

  it("links the investment detail to the position", () => {
    mockDetail.mockReturnValue({ data: investmentDetail })
    renderDetails()
    expect(
      screen
        .getByRole("link", { name: "Ver operação de investimento" })
        .getAttribute("href")
    ).toBe("/investments/positions/position-1")
  })

  it("hides generic edit and cancellation for an active investment", () => {
    mockDetail.mockReturnValue({ data: investmentDetail })
    renderDetails()
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Cancelar lançamento" })
    ).toBeNull()
  })

  it("keeps the specialized link for a cancelled investment", () => {
    mockDetail.mockReturnValue({
      data: { ...investmentDetail, status: "CANCELLED" },
    })
    renderDetails("CANCELLED")
    expect(
      screen.getByRole("link", { name: "Ver operação de investimento" })
    ).toBeTruthy()
  })

  it("shows income account", () => {
    mockDetail.mockReturnValue({ data: detail })
    renderDetails()
    expect(screen.getByText("Banco")).toBeTruthy()
  })
  it("shows income category", () => {
    mockDetail.mockReturnValue({ data: detail })
    renderDetails()
    expect(screen.getByText("Trabalho")).toBeTruthy()
  })
  it("shows transfer origin and destination", () => {
    mockDetail.mockReturnValue({
      data: {
        ...detail,
        type: "TRANSFER",
        transfer: {
          source: { id: "a", name: "Origem" },
          destination: { id: "b", name: "Destino" },
        },
      },
    })
    renderDetails()
    expect(screen.getByText(/Origem → Destino/)).toBeTruthy()
  })
  it("does not require a transfer category", () => {
    mockDetail.mockReturnValue({
      data: {
        ...detail,
        type: "TRANSFER",
        categories: [],
        transfer: {
          source: { id: "a", name: "Origem" },
          destination: { id: "b", name: "Destino" },
        },
      },
    })
    renderDetails()
    expect(screen.queryByText(/Categoria:/)).toBeNull()
  })
  it("shows complete chain history", () => {
    mockDetail.mockReturnValue({ data: detail })
    renderDetails()
    expect(screen.getByLabelText("Histórico da cadeia").textContent).toContain(
      "ORIGINAL: Salário"
    )
  })
  it("shows loading geometry", () => {
    mockDetail.mockReturnValue({ isPending: true })
    renderDetails()
    expect(
      screen.getByLabelText("Carregando detalhes da transação")
    ).toBeTruthy()
  })
  it("retries detail errors", () => {
    const refetch = vi.fn()
    mockDetail.mockReturnValue({ isError: true, refetch })
    renderDetails()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
  it("exposes actions for active chains", () => {
    mockDetail.mockReturnValue({ data: detail })
    renderDetails("ACTIVE")
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Cancelar lançamento" })
    ).toBeTruthy()
  })
  it("exposes actions for edited chains", () => {
    mockDetail.mockReturnValue({ data: detail })
    renderDetails("EDITED")
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy()
  })
  it("hides actions for cancelled chains", () => {
    mockDetail.mockReturnValue({ data: detail })
    renderDetails("CANCELLED")
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Cancelar lançamento" })
    ).toBeNull()
  })
})
