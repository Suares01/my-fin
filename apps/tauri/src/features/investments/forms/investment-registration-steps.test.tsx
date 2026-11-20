/* @vitest-environment jsdom */

import type {
  InvestmentAccountView,
  InvestmentInstrumentView,
} from "@workspace/application"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useForm } from "react-hook-form"
import {
  InvestmentRegistrationAccountingStep,
  InvestmentRegistrationChoiceStep,
  InvestmentRegistrationPositionStep,
} from "./investment-registration-steps"
import { filterInvestmentInstruments } from "./investment-registration-search"
import {
  openingFormDefaults,
  type OpeningFormValues,
} from "./open-investment-position-form-model"

const instruments: readonly InvestmentInstrumentView[] = [
  {
    id: "cdb-1",
    instrumentClass: "FIXED_INCOME",
    version: 0,
    name: "CDB Liquidez",
    type: "CDB",
    currency: "BRL",
    issuerName: "Banco Exemplo",
    status: "ACTIVE",
    identifiers: [],
  },
  {
    id: "stock-1",
    instrumentClass: "EQUITY",
    version: 0,
    name: "Empresa",
    type: "STOCK",
    currency: "BRL",
    status: "ACTIVE",
    identifiers: [{ scheme: "TICKER", value: "ABCD3", market: "B3" }],
  },
  {
    id: "inactive-1",
    instrumentClass: "EQUITY",
    version: 0,
    name: "Empresa inativa",
    type: "STOCK",
    currency: "BRL",
    status: "ARCHIVED",
    identifiers: [],
  },
  {
    id: "usd-1",
    instrumentClass: "EQUITY",
    version: 0,
    name: "Empresa em dólar",
    type: "STOCK",
    currency: "USD",
    status: "ACTIVE",
    identifiers: [],
  },
]

const accounts: readonly InvestmentAccountView[] = [
  {
    id: "wallet-1",
    name: "Corretora",
    currency: "BRL",
    status: "ACTIVE",
    ledgerBalanceMinor: "0",
    positionCostMinor: "0",
    cashMinor: "0",
    marketValueMinor: "0",
    unrealizedResultMinor: "0",
  },
]

function ChoiceHarness() {
  const form = useForm<OpeningFormValues>({
    defaultValues: openingFormDefaults,
  })
  return (
    <InvestmentRegistrationChoiceStep
      control={form.control}
      accounts={accounts}
      instruments={instruments}
      currency="BRL"
      disabled={false}
      onCreateWallet={() => undefined}
      onCreateInstrument={() => undefined}
    />
  )
}

function PositionHarness({
  mode = "OWNED",
  fixedIncome = true,
  rateKind = "",
}: {
  readonly mode?: OpeningFormValues["mode"]
  readonly fixedIncome?: boolean
  readonly rateKind?: OpeningFormValues["rateKind"]
}) {
  const form = useForm<OpeningFormValues>({
    defaultValues: { ...openingFormDefaults, mode, rateKind },
  })
  return (
    <InvestmentRegistrationPositionStep
      control={form.control}
      mode={mode}
      currency="BRL"
      fixedIncome={fixedIncome}
      unitsRequired={false}
      rateKind={rateKind}
      quantityMode="AMOUNT"
      disabled={false}
    />
  )
}

function AccountingHarness() {
  const form = useForm<OpeningFormValues>({
    defaultValues: { ...openingFormDefaults, origin: "NOT_RECORDED" },
  })
  return (
    <InvestmentRegistrationAccountingStep
      control={form.control}
      mode="OWNED"
      origin="NOT_RECORDED"
      externalAccounts={[{ accountId: "bank-1", accountName: "Banco" }]}
      disabled={false}
    />
  )
}

describe("investment registration steps", () => {
  afterEach(cleanup)

  it("filters instruments by name, type, issuer and identifier", () => {
    expect(filterInvestmentInstruments(instruments, "liquidez")).toEqual([
      instruments[0],
    ])
    expect(filterInvestmentInstruments(instruments, "cdb")).toEqual([
      instruments[0],
    ])
    expect(filterInvestmentInstruments(instruments, "banco")).toEqual([
      instruments[0],
    ])
    expect(filterInvestmentInstruments(instruments, "abcd3")).toEqual([
      instruments[1],
    ])
  })

  it("shows only scenario, instrument and wallet in the first step", () => {
    render(<ChoiceHarness />)
    expect(screen.getByText("O que você quer registrar?")).toBeTruthy()
    expect(screen.getByLabelText("Instrumento")).toBeTruthy()
    expect(screen.getByText("Carteira")).toBeTruthy()
    expect(screen.queryByText("Custo contábil")).toBeNull()
  })

  it("searches and selects an existing instrument", () => {
    render(<ChoiceHarness />)
    fireEvent.change(screen.getByLabelText("Instrumento"), {
      target: { value: "ABCD3" },
    })
    expect(screen.getByRole("option", { name: /Empresa/ })).toBeTruthy()
    expect(screen.queryByRole("option", { name: /CDB Liquidez/ })).toBeNull()
    fireEvent.click(screen.getByRole("option", { name: /Empresa/ }))
    expect(
      screen
        .getByRole("option", { name: /Empresa/ })
        .getAttribute("aria-selected")
    ).toBe("true")
  })

  it("offers only active instruments in the book currency", () => {
    render(<ChoiceHarness />)
    expect(screen.queryByRole("option", { name: /Empresa inativa/ })).toBeNull()
    expect(
      screen.queryByRole("option", { name: /Empresa em dólar/ })
    ).toBeNull()
    expect(screen.getByRole("option", { name: /CDB Liquidez/ })).toBeTruthy()
    expect(screen.getByRole("option", { name: /Empresa/ })).toBeTruthy()
  })

  it("keeps optional fixed-income terms behind advanced disclosure", () => {
    render(<PositionHarness />)
    expect(screen.queryByText("Termos de renda fixa")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    expect(screen.getByText("Termos de renda fixa")).toBeTruthy()
    expect(screen.getByLabelText("Rótulo da posição")).toBeTruthy()
    expect(screen.queryByLabelText("Descrição")).toBeNull()
    expect(screen.getByText(/valor atual poderá ser registrado/)).toBeTruthy()
  })

  it("shows only the advanced fields applicable to a purchase", () => {
    render(<PositionHarness mode="BUY" fixedIncome={false} />)
    expect(screen.getByLabelText("Valor principal")).toBeTruthy()
    expect(screen.getByText(/Valor que será alocado, em BRL/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    expect(screen.getByLabelText("Rótulo da posição")).toBeTruthy()
    expect(screen.getByLabelText("Descrição")).toBeTruthy()
    expect(screen.queryByText("Termos de renda fixa")).toBeNull()
  })

  it("shows only the fixed-income fields for the selected rate kind", () => {
    render(<PositionHarness rateKind="PREFIXED" />)
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    expect(screen.getByLabelText("Taxa anual")).toBeTruthy()
    expect(screen.queryByLabelText("Índice")).toBeNull()
    expect(screen.queryByLabelText("Percentual do índice")).toBeNull()
    expect(screen.queryByLabelText("Spread anual")).toBeNull()
  })

  it("explains missing wealth without hiding its accounting effect", () => {
    render(<AccountingHarness />)
    expect(
      screen.getByText("Como este valor já aparece no My Fin?")
    ).toBeTruthy()
    expect(screen.getByText("Ainda não aparece no My Fin")).toBeTruthy()
    expect(
      screen.getByLabelText("Caixa real que já existe na carteira")
    ).toBeTruthy()
    expect(screen.getByText(/saldo inicial explícito/)).toBeTruthy()
  })
})
