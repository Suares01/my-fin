/* @vitest-environment jsdom */

import type { InvestmentOpeningPreview } from "@workspace/application"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvestmentRegistrationReview } from "./investment-registration-review"
import { openingFormDefaults } from "./open-investment-position-form-model"

const preview: InvestmentOpeningPreview = {
  bookCostDeltaMinor: "10000",
  netCashFlowMinor: "0",
  projectedCashMinor: "500",
  openingBalanceMinor: "10500",
  postings: [],
  categories: {},
  warnings: [],
}

const values = {
  ...openingFormDefaults,
  origin: "NOT_RECORDED" as const,
  quantityMode: "UNITS" as const,
  quantity: "10",
  investmentAccountId: "wallet-1",
  instrumentId: "instrument-1",
  costDisplay: "100,00",
  initialCashDisplay: "5,00",
  occurredOn: "2026-11-12",
}

describe("InvestmentRegistrationReview", () => {
  afterEach(cleanup)

  it("shows the essential position and accounting preview", () => {
    render(
      <InvestmentRegistrationReview
        values={values}
        walletName="Carteira"
        instrumentName="CDB"
        externalAccountNames={{}}
        currency="BRL"
        preview={preview}
        previewPending={false}
        previewError={null}
        onRetryPreview={() => undefined}
        needsOpeningBalanceConfirmation
        openingBalanceConfirmed={false}
        onConfirmOpeningBalance={() => undefined}
      />
    )
    expect(screen.getByText("Revise antes de confirmar")).toBeTruthy()
    expect(screen.getByText("Posição existente")).toBeTruthy()
    expect(screen.getByText("CDB")).toBeTruthy()
    expect(screen.getAllByText("Carteira")).toHaveLength(2)
    expect(screen.getByText("Custo contábil")).toBeTruthy()
    expect(screen.getByText("10")).toBeTruthy()
    expect(screen.getByText("Patrimônio ainda não registrado")).toBeTruthy()
    expect(screen.getByText("2026-11-12")).toBeTruthy()
    expect(screen.getAllByText(/R\$\s*100,00/).length).toBeGreaterThan(0)
    expect(screen.getByText("Movimento de caixa")).toBeTruthy()
    expect(screen.getByText(/R\$\s*0,00/)).toBeTruthy()
    expect(screen.getByText("Caixa da carteira após o registro")).toBeTruthy()
    expect(screen.getByText(/R\$\s*5,00/)).toBeTruthy()
    expect(screen.getAllByText(/R\$\s*105,00/)).toHaveLength(2)
    expect(screen.getByText(/aumenta o patrimônio contábil/)).toBeTruthy()
  })

  it("requires a separate opening-balance confirmation", () => {
    const confirm = vi.fn()
    render(
      <InvestmentRegistrationReview
        values={values}
        walletName="Carteira"
        instrumentName="CDB"
        externalAccountNames={{}}
        currency="BRL"
        preview={preview}
        previewPending={false}
        previewError={null}
        onRetryPreview={() => undefined}
        needsOpeningBalanceConfirmation
        openingBalanceConfirmed={false}
        onConfirmOpeningBalance={confirm}
      />
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar registro do saldo inicial",
      })
    )
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it("offers retry and does not present stale values after preview failure", () => {
    const retry = vi.fn()
    render(
      <InvestmentRegistrationReview
        values={values}
        walletName="Carteira"
        instrumentName="CDB"
        externalAccountNames={{}}
        currency="BRL"
        preview={null}
        previewPending={false}
        previewError="Serviço indisponível."
        onRetryPreview={retry}
        needsOpeningBalanceConfirmation={false}
        openingBalanceConfirmed={false}
        onConfirmOpeningBalance={() => undefined}
      />
    )
    expect(screen.getByText("Serviço indisponível.")).toBeTruthy()
    expect(screen.queryByText(/R\$\s*105,00/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("explains that incomplete data has no preview values", () => {
    render(
      <InvestmentRegistrationReview
        values={values}
        walletName="Carteira"
        instrumentName="CDB"
        externalAccountNames={{}}
        currency="BRL"
        preview={null}
        previewPending={false}
        previewError={null}
        onRetryPreview={() => undefined}
        needsOpeningBalanceConfirmation={false}
        openingBalanceConfirmed={false}
        onConfirmOpeningBalance={() => undefined}
      />
    )
    expect(
      screen.getByText("Volte e complete os dados para calcular a prévia.")
    ).toBeTruthy()
    expect(screen.queryByText("Custo alocado")).toBeNull()
    expect(screen.queryByText("Movimento de caixa")).toBeNull()
  })

  it("names external-account postings and warns about negative cash", () => {
    render(
      <InvestmentRegistrationReview
        values={{
          ...values,
          origin: "EXTERNAL_ACCOUNT",
          externalAccountId: "bank-1",
        }}
        walletName="Carteira"
        instrumentName="CDB"
        externalAccountNames={{ "bank-1": "Banco" }}
        currency="BRL"
        preview={{
          ...preview,
          openingBalanceMinor: undefined,
          projectedCashMinor: "-10000",
          postings: [
            { accountId: "bank-1", amountMinor: "-10000" },
            { accountId: "wallet-1", amountMinor: "10000" },
          ],
          warnings: [
            {
              code: "INVESTMENT_CASH_NEGATIVE",
              investmentAccountId: "wallet-1",
              cashMinor: "-10000",
              currency: "BRL",
              asOf: "2026-11-12",
            },
          ],
        }}
        previewPending={false}
        previewError={null}
        onRetryPreview={() => undefined}
        needsOpeningBalanceConfirmation={false}
        openingBalanceConfirmed={false}
        onConfirmOpeningBalance={() => undefined}
      />
    )
    expect(screen.getByText("Banco")).toBeTruthy()
    expect(screen.getByText("O caixa da carteira ficará negativo")).toBeTruthy()
  })
})
