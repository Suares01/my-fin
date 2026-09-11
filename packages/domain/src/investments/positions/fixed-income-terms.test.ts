import { describe, expect, it } from "vitest"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { FixedIncomeTerms } from "./fixed-income-terms.js"

describe("FixedIncomeTerms", () => {
  it("accepts unknown terms for a fixed-income position", () => {
    expect(FixedIncomeTerms.create("FIXED_INCOME", undefined)).toBeUndefined()
  })

  it("accepts a complete prefixed rate", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        rateKind: "PREFIXED",
        annualRate: "12.50",
      })?.toSnapshot()
    ).toEqual({ rateKind: "PREFIXED", annualRate: "12.5" })
  })

  it("accepts a CDI indexed rate above 100 percent", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        rateKind: "INDEXED",
        index: "CDI",
        indexPercentage: "105",
      })?.toSnapshot()
    ).toEqual({ rateKind: "INDEXED", index: "CDI", indexPercentage: "105" })
  })

  it("accepts a complete hybrid rate", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        rateKind: "HYBRID",
        index: "IPCA",
        indexPercentage: "100",
        annualSpreadRate: "6.250",
      })?.toSnapshot()
    ).toEqual({
      rateKind: "HYBRID",
      index: "IPCA",
      indexPercentage: "100",
      annualSpreadRate: "6.25",
    })
  })

  it("preserves partial known dates in chronological order", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        issueDate: "2026-01-01",
        gracePeriodDate: "2026-06-01",
        maturityDate: "2027-01-01",
      })?.toSnapshot()
    ).toEqual({
      issueDate: "2026-01-01",
      gracePeriodDate: "2026-06-01",
      maturityDate: "2027-01-01",
    })
  })

  it("keeps an elapsed maturity date as descriptive terms", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        maturityDate: "2020-01-01",
      })?.toSnapshot().maturityDate
    ).toBe("2020-01-01")
  })

  it.each(["issueDate", "gracePeriodDate", "maturityDate"] as const)(
    "accepts a single known %s without inferring the other dates",
    (field) => {
      expect(
        FixedIncomeTerms.create("FIXED_INCOME", {
          [field]: "2026-01-01",
        })?.toSnapshot()
      ).toEqual({ [field]: "2026-01-01" })
    }
  )

  it("accepts the OTHER index", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        rateKind: "INDEXED",
        index: "OTHER",
        indexPercentage: "0",
      })?.toSnapshot()
    ).toEqual({ rateKind: "INDEXED", index: "OTHER", indexPercentage: "0" })
  })

  it("accepts zero annual and spread rates", () => {
    expect(
      FixedIncomeTerms.create("FIXED_INCOME", {
        rateKind: "HYBRID",
        index: "SELIC",
        indexPercentage: "0",
        annualSpreadRate: "0",
      })?.toSnapshot().annualSpreadRate
    ).toBe("0")
  })

  it("returns a snapshot that cannot overwrite the contracted terms", () => {
    const terms = FixedIncomeTerms.create("FIXED_INCOME", {
      rateKind: "PREFIXED",
      annualRate: "10",
    })
    const snapshot = terms?.toSnapshot() as { annualRate?: string }
    snapshot.annualRate = "99"

    expect(terms?.toSnapshot().annualRate).toBe("10")
  })

  it("rejects terms outside fixed income", () => {
    expectInvalid(() =>
      FixedIncomeTerms.create("EQUITY", {
        rateKind: "PREFIXED",
        annualRate: "10",
      })
    )
  })

  it.each([
    { rateKind: "PREFIXED" },
    { rateKind: "INDEXED", index: "CDI" },
    { rateKind: "INDEXED", indexPercentage: "100" },
    { rateKind: "HYBRID", index: "CDI", indexPercentage: "100" },
    { rateKind: "HYBRID", index: "CDI", annualSpreadRate: "1" },
    { rateKind: "HYBRID", indexPercentage: "100", annualSpreadRate: "1" },
  ] as const)(
    "rejects a rate variant missing a required component",
    (terms) => {
      expectInvalid(() => FixedIncomeTerms.create("FIXED_INCOME", terms))
    }
  )

  it.each([
    { rateKind: "INDEXED", index: "IBOVESPA", indexPercentage: "100" },
    { rateKind: "PREFIXED", annualRate: "-0.01" },
    {
      rateKind: "HYBRID",
      index: "IGPM",
      indexPercentage: "100",
      annualSpreadRate: "-1",
    },
  ] as const)("rejects an unsupported index or negative rate", (terms) => {
    expectInvalid(() => FixedIncomeTerms.create("FIXED_INCOME", terms))
  })

  it.each([
    { issueDate: "2026-06-02", gracePeriodDate: "2026-06-01" },
    { gracePeriodDate: "2026-06-02", maturityDate: "2026-06-01" },
    { issueDate: "2026-06-02", maturityDate: "2026-06-01" },
  ])("rejects every known date pair out of order", (terms) => {
    expectInvalid(() => FixedIncomeTerms.create("FIXED_INCOME", terms))
  })

  it("rejects an invalid known date", () => {
    expectInvalid(() =>
      FixedIncomeTerms.create("FIXED_INCOME", { maturityDate: "2026-02-30" })
    )
  })
})

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected fixed-income terms to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVALID_FIXED_INCOME_TERMS")
  }
}
