import type {
  BookId,
  InvestmentPositionId,
  InvestmentValuationId,
} from "../../shared/identity/ids.js"
import { Currency } from "../../shared/identity/currency.js"
import { Decimal } from "../../shared/decimal.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { LocalDate } from "../../shared/local-date.js"

export interface InvestmentValuationSnapshot {
  readonly id: InvestmentValuationId
  readonly bookId: BookId
  readonly positionId: InvestmentPositionId
  readonly allocationRevision: number
  readonly valuedAt: string
  readonly valuedOn: string
  readonly recordedAt: string
  readonly recordSequence: string
  readonly source: "MANUAL"
  readonly quantity?: string
  readonly unitPrice?: string
  readonly currency: string
  readonly grossValueMinor: string
  readonly netValueMinor?: string
  readonly withdrawableValueMinor?: string
}
export interface CreateInvestmentValuationInput extends Omit<
  InvestmentValuationSnapshot,
  "source"
> {
  readonly positionCurrency: string
  readonly positionQuantity?: string
}
export class InvestmentValuation {
  private constructor(
    private readonly valuation: InvestmentValuationSnapshot
  ) {}
  static create(input: CreateInvestmentValuationInput): InvestmentValuation {
    const currency = Currency.parse(input.currency)
    if (!currency.equals(Currency.parse(input.positionCurrency)))
      throw invalid()
    if (
      !Number.isSafeInteger(input.allocationRevision) ||
      input.allocationRevision < 1 ||
      !/^[1-9]\d*$/.test(input.recordSequence)
    )
      throw invalid()
    timestamp(input.valuedAt)
    timestamp(input.recordedAt)
    date(input.valuedOn)
    const grossValueMinor = nonNegativeInteger(input.grossValueMinor)
    const netValueMinor = optionalInteger(input.netValueMinor)
    const withdrawableValueMinor = optionalInteger(input.withdrawableValueMinor)
    const positionQuantity =
      input.positionQuantity === undefined
        ? undefined
        : nonNegativeDecimal(input.positionQuantity)
    const quantity =
      input.quantity === undefined
        ? undefined
        : nonNegativeDecimal(input.quantity)
    const unitPrice =
      input.unitPrice === undefined
        ? undefined
        : nonNegativeDecimal(input.unitPrice)
    if (
      (positionQuantity === undefined &&
        (quantity !== undefined || unitPrice !== undefined)) ||
      (positionQuantity !== undefined &&
        (quantity === undefined ||
          unitPrice === undefined ||
          quantity !== positionQuantity))
    )
      throw invalid()
    return new InvestmentValuation({
      id: input.id,
      bookId: input.bookId,
      positionId: input.positionId,
      allocationRevision: input.allocationRevision,
      valuedAt: input.valuedAt,
      valuedOn: input.valuedOn,
      recordedAt: input.recordedAt,
      recordSequence: input.recordSequence,
      source: "MANUAL",
      ...(quantity === undefined ? {} : { quantity }),
      ...(unitPrice === undefined ? {} : { unitPrice }),
      currency: currency.code,
      grossValueMinor,
      ...(netValueMinor === undefined ? {} : { netValueMinor }),
      ...(withdrawableValueMinor === undefined
        ? {}
        : { withdrawableValueMinor }),
    })
  }
  toSnapshot(): InvestmentValuationSnapshot {
    return {
      ...this.valuation,
      ...(this.valuation.quantity === undefined ? { quantity: undefined } : {}),
      ...(this.valuation.unitPrice === undefined
        ? { unitPrice: undefined }
        : {}),
      ...(this.valuation.netValueMinor === undefined
        ? { netValueMinor: undefined }
        : {}),
      ...(this.valuation.withdrawableValueMinor === undefined
        ? { withdrawableValueMinor: undefined }
        : {}),
    }
  }
  pullDomainFacts(): readonly [] {
    return []
  }
}
function nonNegativeInteger(value: string): string {
  if (!/^\d+$/.test(value)) throw invalid()
  return BigInt(value).toString()
}
function optionalInteger(value: string | undefined): string | undefined {
  return value === undefined ? undefined : nonNegativeInteger(value)
}
function nonNegativeDecimal(value: string): string {
  try {
    const decimal = Decimal.parse(value)
    if (decimal.compare(Decimal.parse("0")) < 0) throw invalid()
    return decimal.toString()
  } catch {
    throw invalid()
  }
}
function date(value: string): void {
  try {
    LocalDate.parse(value)
  } catch {
    throw invalid()
  }
}
function timestamp(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
    throw invalid()
}
function invalid(): DomainError {
  return new DomainError(
    "INVALID_INVESTMENT_VALUATION",
    "Investment valuation is invalid"
  )
}
