import type {
  BookId,
  InvestmentInstrumentId,
} from "../../shared/identity/ids.js"
import { Currency } from "../../shared/identity/currency.js"
import { AggregateRoot } from "../../shared/kernel/aggregate-root.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { normalizeSearchText } from "../../shared/search-text.js"

export const INVESTMENT_INSTRUMENT_TYPES = [
  "CDB",
  "RDB",
  "LCI",
  "LCA",
  "LC",
  "CRI",
  "CRA",
  "DEBENTURE",
  "LF",
  "LIG",
  "TREASURY",
  "STOCK",
  "BDR",
  "ETF",
  "REAL_ESTATE_FUND",
  "MUTUAL_FUND",
  "PGBL",
  "VGBL",
  "COE",
  "CRYPTO_ASSET",
  "OTHER",
] as const
export type InvestmentInstrumentType =
  (typeof INVESTMENT_INSTRUMENT_TYPES)[number]
export type InvestmentInstrumentClass =
  | "FIXED_INCOME"
  | "EQUITY"
  | "FUND"
  | "PENSION"
  | "STRUCTURED"
  | "CRYPTO"
  | "OTHER"
export const INSTRUMENT_IDENTIFIER_SCHEMES = [
  "TICKER",
  "ISIN",
  "REGISTRATION_NUMBER",
  "OTHER",
] as const
export type InstrumentIdentifierScheme =
  (typeof INSTRUMENT_IDENTIFIER_SCHEMES)[number]

export interface InstrumentIdentifierSnapshot {
  readonly scheme: InstrumentIdentifierScheme
  readonly value: string
  readonly market?: string
}
export interface InvestmentInstrumentSnapshot {
  readonly id: InvestmentInstrumentId
  readonly bookId: BookId
  readonly name: string
  readonly normalizedName: string
  readonly type: InvestmentInstrumentType
  readonly currency: string
  readonly issuerName?: string
  readonly identifiers: readonly InstrumentIdentifierSnapshot[]
  readonly status: "ACTIVE" | "ARCHIVED"
  readonly version: number
}
export interface CreateInvestmentInstrumentInput {
  readonly id: InvestmentInstrumentId
  readonly bookId: BookId
  readonly name: string
  readonly type: InvestmentInstrumentType
  readonly currency: string
  readonly baseCurrency: string
  readonly issuerName?: string
  readonly identifiers?: readonly InstrumentIdentifierSnapshot[]
}

export function investmentInstrumentClassFor(
  type: InvestmentInstrumentType
): InvestmentInstrumentClass {
  if (
    [
      "CDB",
      "RDB",
      "LCI",
      "LCA",
      "LC",
      "CRI",
      "CRA",
      "DEBENTURE",
      "LF",
      "LIG",
      "TREASURY",
    ].includes(type)
  )
    return "FIXED_INCOME"
  if (["STOCK", "BDR"].includes(type)) return "EQUITY"
  if (["ETF", "REAL_ESTATE_FUND", "MUTUAL_FUND"].includes(type)) return "FUND"
  if (["PGBL", "VGBL"].includes(type)) return "PENSION"
  if (type === "COE") return "STRUCTURED"
  return type === "CRYPTO_ASSET" ? "CRYPTO" : "OTHER"
}

export function instrumentIdentifier(
  input: InstrumentIdentifierSnapshot
): InstrumentIdentifierSnapshot {
  const value = input.value.trim()
  const market = input.market?.trim()
  if (value.length === 0 || value.length > 120 || (market?.length ?? 0) > 40)
    throw invalidInput()
  if (input.scheme === "TICKER" && market === undefined) throw invalidInput()
  if (input.scheme === "ISIN" && market !== undefined) throw invalidInput()
  const upper = input.scheme === "TICKER" || input.scheme === "ISIN"
  return {
    scheme: input.scheme,
    value: upper ? value.toUpperCase() : value,
    ...(market === undefined ? {} : { market: market.toUpperCase() }),
  }
}

export class InvestmentInstrument extends AggregateRoot<
  InvestmentInstrumentId,
  InvestmentInstrumentSnapshot
> {
  private constructor(private instrument: InvestmentInstrumentSnapshot) {
    super(instrument.id)
  }
  static create(input: CreateInvestmentInstrumentInput): InvestmentInstrument {
    const name = requiredText(input.name)
    if (input.currency !== input.baseCurrency)
      throw new DomainError(
        "INVESTMENT_CURRENCY_MISMATCH",
        "Instrument currency must match the book currency"
      )
    Currency.parse(input.currency)
    const identifiers = normalizeIdentifiers(input.identifiers ?? [])
    const instrument = new InvestmentInstrument({
      id: input.id,
      bookId: input.bookId,
      name,
      normalizedName: normalizeSearchText(name),
      type: input.type,
      currency: input.currency,
      ...(optionalText(input.issuerName) === undefined
        ? {}
        : { issuerName: optionalText(input.issuerName) }),
      identifiers,
      status: "ACTIVE",
      version: 0,
    })
    instrument.record("InvestmentInstrumentCreated")
    return instrument
  }
  static restore(snapshot: InvestmentInstrumentSnapshot): InvestmentInstrument {
    requiredText(snapshot.name)
    Currency.parse(snapshot.currency)
    return new InvestmentInstrument({
      ...snapshot,
      identifiers: normalizeIdentifiers(snapshot.identifiers),
      ...(optionalText(snapshot.issuerName) === undefined
        ? {}
        : { issuerName: optionalText(snapshot.issuerName) }),
    })
  }
  get bookId() {
    return this.instrument.bookId
  }
  get name() {
    return this.instrument.name
  }
  get type() {
    return this.instrument.type
  }
  get instrumentClass() {
    return investmentInstrumentClassFor(this.instrument.type)
  }
  get status() {
    return this.instrument.status
  }
  get version() {
    return this.instrument.version
  }
  updateMetadata(input: {
    readonly name: string
    readonly issuerName?: string
    readonly identifiers: readonly InstrumentIdentifierSnapshot[]
  }): void {
    const name = requiredText(input.name),
      issuerName = optionalText(input.issuerName),
      identifiers = normalizeIdentifiers(input.identifiers)
    const next = {
      ...this.instrument,
      name,
      normalizedName: normalizeSearchText(name),
      ...(issuerName === undefined ? {} : { issuerName }),
      identifiers,
    }
    if (JSON.stringify(next) === JSON.stringify(this.instrument)) return
    this.instrument = { ...next, version: this.version + 1 }
    this.record("InvestmentInstrumentUpdated")
  }
  updateType(
    type: InvestmentInstrumentType,
    hasHistoricalPosition: boolean
  ): void {
    if (type === this.type) return
    if (hasHistoricalPosition)
      throw new DomainError(
        "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE",
        "Instrument type cannot change after first position"
      )
    this.instrument = { ...this.instrument, type, version: this.version + 1 }
    this.record("InvestmentInstrumentUpdated")
  }
  archive(hasOpenPosition: boolean): void {
    if (hasOpenPosition)
      throw new DomainError(
        "INVESTMENT_INSTRUMENT_IN_USE",
        "Instrument has an open position"
      )
    if (this.status === "ARCHIVED") return
    this.instrument = {
      ...this.instrument,
      status: "ARCHIVED",
      version: this.version + 1,
    }
    this.record("InvestmentInstrumentArchived")
  }
  reactivate(): void {
    if (this.status === "ACTIVE") return
    this.instrument = {
      ...this.instrument,
      status: "ACTIVE",
      version: this.version + 1,
    }
    this.record("InvestmentInstrumentReactivated")
  }
  toSnapshot(): InvestmentInstrumentSnapshot {
    return {
      ...this.instrument,
      identifiers: this.instrument.identifiers.map((identifier) => ({
        ...identifier,
      })),
    }
  }
  private record(type: string) {
    this.recordFact({
      type,
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.toSnapshot(),
    })
  }
}

function normalizeIdentifiers(
  values: readonly InstrumentIdentifierSnapshot[]
): readonly InstrumentIdentifierSnapshot[] {
  if (values.length > 20) throw invalidInput()
  const normalized = values.map(instrumentIdentifier)
  const keys = new Set<string>()
  for (const value of normalized) {
    const key =
      value.scheme === "ISIN"
        ? `${value.scheme}:${value.value}`
        : `${value.scheme}:${value.value}:${value.market ?? ""}`
    if (keys.has(key))
      throw new DomainError(
        "DUPLICATE_INSTRUMENT_IDENTIFIER",
        "Instrument identifier is duplicated"
      )
    keys.add(key)
  }
  return normalized
}
function requiredText(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 120) throw invalidInput()
  return trimmed
}
function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length > 120) throw invalidInput()
  return trimmed
}
function invalidInput(): DomainError {
  return new DomainError(
    "INVALID_INVESTMENT_INPUT",
    "Investment instrument input is invalid"
  )
}
