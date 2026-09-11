import { describe, expect, it } from "vitest"
import { ledgerAccountIdFromString } from "../shared/identity/ids.js"
import { DomainError } from "../shared/kernel/domain-error.js"
import {
  assertFinancialAccountProfileAllowed,
  FinancialAccountProfile,
  ledgerAccountKindForFinancialType,
} from "./financial-account-profile.js"

describe("FinancialAccountProfile", () => {
  it.each([
    ["BANK_ACCOUNT", "ASSET"],
    ["PAYMENT_ACCOUNT", "ASSET"],
    ["INVESTMENT_ACCOUNT", "ASSET"],
    ["CASH", "ASSET"],
    ["OTHER_ASSET", "ASSET"],
    ["CREDIT_CARD", "LIABILITY"],
    ["OTHER_LIABILITY", "LIABILITY"],
  ] as const)("maps %s to %s", (type, kind) => {
    expect(ledgerAccountKindForFinancialType(type)).toBe(kind)
  })

  it("allows investment institution and settlement reference to be absent", () => {
    expect(
      FinancialAccountProfile.create({
        type: "INVESTMENT_ACCOUNT",
      }).toSnapshot()
    ).toEqual({
      type: "INVESTMENT_ACCOUNT",
      investment: {},
    })
  })

  it("normalizes optional display metadata and keeps settlement on investment", () => {
    expect(
      FinancialAccountProfile.create({
        type: "INVESTMENT_ACCOUNT",
        institutionName: " Banco ABC ",
        displayReference: " 123-4 ",
        investment: {
          defaultSettlementAccountId: ledgerAccountIdFromString("bank-1"),
        },
      }).toSnapshot()
    ).toEqual({
      type: "INVESTMENT_ACCOUNT",
      institutionName: "Banco ABC",
      displayReference: "123-4",
      investment: { defaultSettlementAccountId: "bank-1" },
    })
  })

  it("rejects investment settings on non-investment accounts", () => {
    expectInvalid(() =>
      FinancialAccountProfile.create({
        type: "BANK_ACCOUNT",
        investment: {
          defaultSettlementAccountId: ledgerAccountIdFromString("bank-1"),
        },
      })
    )
  })

  it.each([
    ["INCOME", undefined],
    ["EXPENSE", undefined],
    ["EQUITY", undefined],
    ["ASSET", "OPENING_BALANCE"],
  ] as const)(
    "rejects profile association with %s/%s",
    (kind, systemPurpose) => {
      expectInvalid(() =>
        assertFinancialAccountProfileAllowed({
          profile: FinancialAccountProfile.create({ type: "BANK_ACCOUNT" }),
          kind,
          ...(systemPurpose === undefined ? {} : { systemPurpose }),
        })
      )
    }
  )

  it("rejects a profile whose type maps to another ledger kind", () => {
    expectInvalid(() =>
      assertFinancialAccountProfileAllowed({
        profile: FinancialAccountProfile.create({ type: "CREDIT_CARD" }),
        kind: "ASSET",
      })
    )
  })

  it("rejects display metadata longer than the normative maximum", () => {
    expectInvalid(() =>
      FinancialAccountProfile.create({
        type: "BANK_ACCOUNT",
        institutionName: "x".repeat(121),
      })
    )
  })
})

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected action to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(
      "INVALID_FINANCIAL_ACCOUNT_PROFILE"
    )
  }
}
