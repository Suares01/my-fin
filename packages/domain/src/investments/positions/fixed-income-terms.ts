import type { InvestmentInstrumentClass } from "../instruments/investment-instrument.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { LocalDate } from "../../shared/local-date.js"
import { Percentage } from "../values/investment-values.js"

export const FIXED_INCOME_INDICES = [
  "CDI",
  "SELIC",
  "IPCA",
  "IGPM",
  "OTHER",
] as const

export type FixedIncomeIndex = (typeof FIXED_INCOME_INDICES)[number]
export type FixedIncomeRateKind = "PREFIXED" | "INDEXED" | "HYBRID"

export interface FixedIncomeTermsSnapshot {
  readonly rateKind?: FixedIncomeRateKind
  readonly index?: FixedIncomeIndex
  readonly annualRate?: string
  readonly indexPercentage?: string
  readonly annualSpreadRate?: string
  readonly issueDate?: string
  readonly gracePeriodDate?: string
  readonly maturityDate?: string
}

export interface FixedIncomeTermsInput {
  readonly rateKind?: FixedIncomeRateKind
  readonly index?: string
  readonly annualRate?: string
  readonly indexPercentage?: string
  readonly annualSpreadRate?: string
  readonly issueDate?: string
  readonly gracePeriodDate?: string
  readonly maturityDate?: string
}

export class FixedIncomeTerms {
  private constructor(private readonly terms: FixedIncomeTermsSnapshot) {}

  static create(
    instrumentClass: InvestmentInstrumentClass,
    input: FixedIncomeTermsInput | undefined
  ): FixedIncomeTerms | undefined {
    if (input === undefined || isEmpty(input)) return undefined
    if (instrumentClass !== "FIXED_INCOME") throw invalidTerms()

    return new FixedIncomeTerms({
      ...normalizeRate(input),
      ...normalizeDates(input),
    })
  }

  static restore(
    instrumentClass: InvestmentInstrumentClass,
    snapshot: FixedIncomeTermsSnapshot | undefined
  ): FixedIncomeTerms | undefined {
    return FixedIncomeTerms.create(instrumentClass, snapshot)
  }

  toSnapshot(): FixedIncomeTermsSnapshot {
    return { ...this.terms }
  }
}

function isEmpty(input: FixedIncomeTermsInput): boolean {
  return Object.values(input).every((value) => value === undefined)
}

function normalizeRate(input: FixedIncomeTermsInput): FixedIncomeTermsSnapshot {
  const hasRateComponent =
    input.index !== undefined ||
    input.annualRate !== undefined ||
    input.indexPercentage !== undefined ||
    input.annualSpreadRate !== undefined

  if (input.rateKind === undefined) {
    if (hasRateComponent) throw invalidTerms()
    return {}
  }

  switch (input.rateKind) {
    case "PREFIXED":
      if (
        input.annualRate === undefined ||
        input.index !== undefined ||
        input.indexPercentage !== undefined ||
        input.annualSpreadRate !== undefined
      ) {
        throw invalidTerms()
      }
      return { rateKind: "PREFIXED", annualRate: parseRate(input.annualRate) }
    case "INDEXED":
      if (
        input.index === undefined ||
        input.indexPercentage === undefined ||
        input.annualRate !== undefined ||
        input.annualSpreadRate !== undefined
      ) {
        throw invalidTerms()
      }
      return {
        rateKind: "INDEXED",
        index: parseIndex(input.index),
        indexPercentage: parseRate(input.indexPercentage),
      }
    case "HYBRID":
      if (
        input.index === undefined ||
        input.indexPercentage === undefined ||
        input.annualSpreadRate === undefined ||
        input.annualRate !== undefined
      ) {
        throw invalidTerms()
      }
      return {
        rateKind: "HYBRID",
        index: parseIndex(input.index),
        indexPercentage: parseRate(input.indexPercentage),
        annualSpreadRate: parseRate(input.annualSpreadRate),
      }
  }
}

function normalizeDates(
  input: FixedIncomeTermsInput
): FixedIncomeTermsSnapshot {
  const issueDate = parseDate(input.issueDate)
  const gracePeriodDate = parseDate(input.gracePeriodDate)
  const maturityDate = parseDate(input.maturityDate)

  if (
    (issueDate !== undefined &&
      gracePeriodDate !== undefined &&
      issueDate.compareTo(gracePeriodDate) > 0) ||
    (gracePeriodDate !== undefined &&
      maturityDate !== undefined &&
      gracePeriodDate.compareTo(maturityDate) > 0) ||
    (issueDate !== undefined &&
      maturityDate !== undefined &&
      issueDate.compareTo(maturityDate) > 0)
  ) {
    throw invalidTerms()
  }

  return {
    ...(issueDate === undefined ? {} : { issueDate: issueDate.toString() }),
    ...(gracePeriodDate === undefined
      ? {}
      : { gracePeriodDate: gracePeriodDate.toString() }),
    ...(maturityDate === undefined
      ? {}
      : { maturityDate: maturityDate.toString() }),
  }
}

function parseIndex(value: string): FixedIncomeIndex {
  if (!FIXED_INCOME_INDICES.includes(value as FixedIncomeIndex)) {
    throw invalidTerms()
  }
  return value as FixedIncomeIndex
}

function parseRate(value: string): string {
  try {
    return Percentage.parse(value).toString()
  } catch {
    throw invalidTerms()
  }
}

function parseDate(value: string | undefined): LocalDate | undefined {
  if (value === undefined) return undefined
  try {
    return LocalDate.parse(value)
  } catch {
    throw invalidTerms()
  }
}

function invalidTerms(): DomainError {
  return new DomainError(
    "INVALID_FIXED_INCOME_TERMS",
    "Fixed-income terms are invalid"
  )
}
