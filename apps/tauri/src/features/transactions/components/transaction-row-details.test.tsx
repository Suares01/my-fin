/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { JournalChainDetail } from "@workspace/application"
import { afterEach, describe, expect, it, vi } from "vitest"
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
  return { props, ...render(<TransactionRowDetails {...props} />) }
}

describe("TransactionRowDetails", () => {
  afterEach(cleanup)
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
    expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy()
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
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull()
  })
})
