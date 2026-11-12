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

function PositionHarness() {
  const form = useForm<OpeningFormValues>({
    defaultValues: openingFormDefaults,
  })
  return (
    <InvestmentRegistrationPositionStep
      control={form.control}
      mode="OWNED"
      currency="BRL"
      fixedIncome
      unitsRequired={false}
      rateKind=""
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

  it("filters instruments by issuer and identifier", () => {
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

  it("keeps optional fixed-income terms behind advanced disclosure", () => {
    render(<PositionHarness />)
    expect(screen.queryByText("Termos de renda fixa")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Detalhes avançados" }))
    expect(screen.getByText("Termos de renda fixa")).toBeTruthy()
    expect(screen.getByText(/valor atual poderá ser registrado/)).toBeTruthy()
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
