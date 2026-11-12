import { describe, expect, it } from "vitest"
import {
  FIXED_INCOME_TYPES,
  UNIT_REQUIRED_TYPES,
  isFixedIncome,
  isUnitsRequired,
  openingFormDefaults,
  openingPreviewCommand,
  openingStepErrors,
  openingTermsError,
  selectedOpeningTerms,
} from "./open-investment-position-form-model"

const context = {
  fixedIncome: false,
  unitsRequired: false,
  externalAccountIds: ["bank-1"],
}

describe("opening investment registration model", () => {
  it.each([...UNIT_REQUIRED_TYPES])("requires units for %s", (type) => {
    expect(isUnitsRequired(type)).toBe(true)
  })

  it.each([...FIXED_INCOME_TYPES])("classifies %s as fixed income", (type) => {
    expect(isFixedIncome(type)).toBe(true)
  })

  it("requires only instrument and wallet in the choice step", () => {
    expect(openingStepErrors("CHOICE", openingFormDefaults, context)).toEqual({
      instrumentId: "Escolha o instrumento.",
      investmentAccountId: "Escolha a carteira.",
    })
  })

  it("requires a positive quantity for unit-controlled instruments", () => {
    expect(
      openingStepErrors(
        "POSITION",
        {
          ...openingFormDefaults,
          costDisplay: "0",
          occurredOn: "2026-11-12",
          quantityMode: "UNITS",
        },
        { ...context, unitsRequired: true }
      )
    ).toEqual({ quantity: "Informe a quantidade." })
  })

  it("keeps quantity absent in amount mode", () => {
    const command = openingPreviewCommand({
      values: {
        ...openingFormDefaults,
        investmentAccountId: "wallet-1",
        instrumentId: "instrument-1",
        costDisplay: "100,00",
        occurredOn: "2026-11-12",
      },
      bookId: "book-1",
      currency: "BRL",
      walletId: "wallet-1",
      instrumentId: "instrument-1",
      fixedIncome: false,
      unitsRequired: false,
      confirmedBalance: false,
      externalAccountIds: ["bank-1"],
    })
    expect(command).toEqual(
      expect.objectContaining({
        kind: "ALLOCATION",
        bookCostMinor: "10000",
        quantityMode: "AMOUNT",
      })
    )
    expect(command).not.toHaveProperty("quantity")
  })

  it("normalizes partial fixed-income terms", () => {
    const values = {
      ...openingFormDefaults,
      rateKind: "HYBRID" as const,
      index: "IPCA",
      indexPercentage: "100",
      annualSpreadRate: "6,5",
      maturityDate: "2030-01-01",
    }
    expect(openingTermsError(values)).toBeNull()
    expect(selectedOpeningTerms(values)).toEqual({
      rateKind: "HYBRID",
      index: "IPCA",
      indexPercentage: "100",
      annualSpreadRate: "6.5",
      maturityDate: "2030-01-01",
    })
  })

  it("rejects incomplete indexed terms and reversed dates", () => {
    expect(
      openingTermsError({
        ...openingFormDefaults,
        rateKind: "INDEXED",
      })
    ).toBe("Informe índice e percentual.")
    expect(
      openingTermsError({
        ...openingFormDefaults,
        issueDate: "2028-01-01",
        maturityDate: "2027-01-01",
      })
    ).toBe("Informe os termos em ordem cronológica.")
  })

  it("requires an explicit known external account", () => {
    expect(
      openingStepErrors(
        "ACCOUNTING",
        {
          ...openingFormDefaults,
          origin: "EXTERNAL_ACCOUNT",
          externalAccountId: "unknown",
        },
        context
      )
    ).toEqual({ externalAccountId: "Escolha a conta de origem." })
  })

  it("proposes cost plus real cash for missing wealth", () => {
    const command = openingPreviewCommand({
      values: {
        ...openingFormDefaults,
        origin: "NOT_RECORDED",
        investmentAccountId: "wallet-1",
        instrumentId: "instrument-1",
        costDisplay: "100,00",
        initialCashDisplay: "5,00",
        occurredOn: "2026-11-12",
      },
      bookId: "book-1",
      currency: "BRL",
      walletId: "wallet-1",
      instrumentId: "instrument-1",
      fixedIncome: false,
      unitsRequired: false,
      confirmedBalance: false,
      externalAccountIds: ["bank-1"],
    })
    expect(command).toEqual(
      expect.objectContaining({
        kind: "ALLOCATION",
        bookCostMinor: "10000",
        proposedOpeningBalanceMinor: "10500",
      })
    )
    expect(command).not.toHaveProperty("valuationMinor")
  })

  it("maps an owned external holding to an explicit application", () => {
    const command = openingPreviewCommand({
      values: {
        ...openingFormDefaults,
        origin: "EXTERNAL_ACCOUNT",
        externalAccountId: "bank-1",
        investmentAccountId: "wallet-1",
        instrumentId: "instrument-1",
        costDisplay: "100,00",
        occurredOn: "2026-11-12",
      },
      bookId: "book-1",
      currency: "BRL",
      walletId: "wallet-1",
      instrumentId: "instrument-1",
      fixedIncome: false,
      unitsRequired: false,
      confirmedBalance: false,
      externalAccountIds: ["bank-1"],
    })
    expect(command).toEqual(
      expect.objectContaining({
        kind: "PURCHASE",
        type: "APPLICATION",
        capitalMinor: "10000",
        funding: { mode: "EXTERNAL_ACCOUNT", accountId: "bank-1" },
      })
    )
  })
})
