import type {
  BookId,
  InvestmentInstrumentId,
  InvestmentPositionId,
  LedgerAccountId,
} from "../../shared/identity/ids.js"
import { Currency } from "../../shared/identity/currency.js"
import { AggregateRoot } from "../../shared/kernel/aggregate-root.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { Decimal } from "../../shared/decimal.js"
import { LocalDate } from "../../shared/local-date.js"
import { Money } from "../../shared/money.js"
import { normalizeSearchText } from "../../shared/search-text.js"
import type { InvestmentInstrumentClass } from "../instruments/investment-instrument.js"
import { assertInvestmentMoneyRange } from "../values/investment-values.js"
import {
  FixedIncomeTerms,
  type FixedIncomeTermsInput,
  type FixedIncomeTermsSnapshot,
} from "./fixed-income-terms.js"

export type InvestmentQuantityMode = "UNITS" | "AMOUNT"
export type InvestmentPositionStatus = "OPEN" | "CLOSED"

export interface InvestmentPositionSnapshot {
  readonly id: InvestmentPositionId
  readonly bookId: BookId
  readonly investmentAccountId: LedgerAccountId
  readonly instrumentId: InvestmentInstrumentId
  readonly label?: string
  readonly normalizedLabel: string
  readonly quantityMode: InvestmentQuantityMode
  readonly quantity?: string
  readonly bookCostMinor: string
  readonly currency: string
  readonly openedOn: string
  readonly closedOn?: string
  readonly status: InvestmentPositionStatus
  readonly fixedIncomeTerms?: FixedIncomeTermsSnapshot
  readonly allocationRevision: number
  readonly allocationEffectiveOn: string
  readonly version: number
}

export interface OpenInvestmentPositionInput {
  readonly id: InvestmentPositionId
  readonly bookId: BookId
  readonly investmentAccountId: LedgerAccountId
  readonly instrumentId: InvestmentInstrumentId
  readonly instrumentClass: InvestmentInstrumentClass
  readonly label?: string
  readonly quantityMode: InvestmentQuantityMode
  readonly quantity?: string
  readonly bookCostMinor: string
  readonly currency: string
  readonly openedOn: string
  readonly fixedIncomeTerms?: FixedIncomeTermsInput
}

export interface PositionOperationEffect {
  readonly quantityDelta?: string
  readonly bookCostDeltaMinor?: string
  readonly occurredOn: string
}

export type PositionCorrection =
  | {
      readonly state: "UNOPENED"
      readonly occurredOn: string
    }
  | {
      readonly quantity?: string
      readonly bookCostMinor: string
      readonly occurredOn: string
    }

export class InvestmentPosition extends AggregateRoot<
  InvestmentPositionId,
  InvestmentPositionSnapshot
> {
  private constructor(private position: InvestmentPositionSnapshot) {
    super(position.id)
  }

  static openWithAllocation(
    input: OpenInvestmentPositionInput
  ): InvestmentPosition {
    const openedOn = parseDate(input.openedOn)
    const currency = Currency.parse(input.currency)
    const quantity = openingQuantity(input.quantityMode, input.quantity)
    const bookCost = parseCost(input.bookCostMinor, currency)
    if (input.quantityMode === "AMOUNT" && bookCost <= 0n)
      throw invalidOperation()
    const terms = FixedIncomeTerms.create(
      input.instrumentClass,
      input.fixedIncomeTerms
    )?.toSnapshot()
    const label = normalizeLabel(input.label)
    const normalizedLabel =
      label === undefined ? "" : normalizeSearchText(label)
    const position = new InvestmentPosition({
      id: input.id,
      bookId: input.bookId,
      investmentAccountId: input.investmentAccountId,
      instrumentId: input.instrumentId,
      ...(label === undefined ? {} : { label }),
      normalizedLabel,
      quantityMode: input.quantityMode,
      ...(quantity === undefined ? {} : { quantity: quantity.toString() }),
      bookCostMinor: bookCost.toString(),
      currency: currency.code,
      openedOn: openedOn.toString(),
      status: "OPEN",
      ...(terms === undefined ? {} : { fixedIncomeTerms: terms }),
      allocationRevision: 1,
      allocationEffectiveOn: openedOn.toString(),
      version: 0,
    })
    position.record("InvestmentPositionOpened")
    return position
  }

  static restore(snapshot: InvestmentPositionSnapshot): InvestmentPosition {
    const currency = Currency.parse(snapshot.currency)
    const quantity = restoredQuantity(snapshot.quantityMode, snapshot.quantity)
    const cost = parseCost(snapshot.bookCostMinor, currency)
    const openedOn = parseDate(snapshot.openedOn)
    const allocationEffectiveOn = parseDate(snapshot.allocationEffectiveOn)
    const closedOn =
      snapshot.closedOn === undefined ? undefined : parseDate(snapshot.closedOn)
    if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 0)
      throw invalidOperation()
    if (
      !Number.isSafeInteger(snapshot.allocationRevision) ||
      snapshot.allocationRevision < 1
    )
      throw invalidOperation()
    const status = deriveStatus(snapshot.quantityMode, quantity, cost)
    if (status !== snapshot.status) throw invalidOperation()
    if ((status === "CLOSED") !== (closedOn !== undefined))
      throw invalidOperation()
    const terms = FixedIncomeTerms.restore(
      snapshot.fixedIncomeTerms === undefined ? "OTHER" : "FIXED_INCOME",
      snapshot.fixedIncomeTerms
    )?.toSnapshot()
    const label = normalizeLabel(snapshot.label)
    const normalizedLabel =
      label === undefined ? "" : normalizeSearchText(label)
    return new InvestmentPosition({
      ...snapshot,
      ...(label === undefined ? {} : { label }),
      normalizedLabel,
      ...(quantity === undefined ? {} : { quantity: quantity.toString() }),
      bookCostMinor: cost.toString(),
      openedOn: openedOn.toString(),
      allocationEffectiveOn: allocationEffectiveOn.toString(),
      ...(closedOn === undefined ? {} : { closedOn: closedOn.toString() }),
      ...(terms === undefined ? {} : { fixedIncomeTerms: terms }),
    })
  }

  get bookId(): BookId {
    return this.position.bookId
  }

  get version(): number {
    return this.position.version
  }

  get allocationRevision(): number {
    return this.position.allocationRevision
  }

  assertCanAllocate(
    investmentAccountActive: boolean,
    instrumentActive: boolean
  ): void {
    this.assertEntitiesActive(investmentAccountActive, instrumentActive)
    if (this.position.status === "CLOSED") throw inactiveEntity()
  }

  assertCanRecordPostClosureCashFlow(
    investmentAccountActive: boolean,
    instrumentActive: boolean
  ): void {
    this.assertEntitiesActive(investmentAccountActive, instrumentActive)
  }

  assertCanReopen(
    investmentAccountActive: boolean,
    instrumentActive: boolean
  ): void {
    this.assertEntitiesActive(investmentAccountActive, instrumentActive)
  }

  updateLabel(label: string | undefined): void {
    const nextLabel = normalizeLabel(label)
    if (nextLabel === this.position.label) return
    this.position = {
      ...this.position,
      ...(nextLabel === undefined
        ? { label: undefined, normalizedLabel: "" }
        : {
            label: nextLabel,
            normalizedLabel: normalizeSearchText(nextLabel),
          }),
      version: nextVersion(this.version),
    }
    this.record("InvestmentPositionChanged")
  }

  applyOperation(effect: PositionOperationEffect): void {
    if (effect.bookCostDeltaMinor === undefined) throw invalidOperation()
    const occurredOn = parseDate(effect.occurredOn)
    const currency = Currency.parse(this.position.currency)
    const cost =
      currentCost(this.position) +
      parseCost(effect.bookCostDeltaMinor, currency)
    const quantity = this.applyQuantityDelta(effect.quantityDelta)
    this.applyEconomicState(quantity, cost, occurredOn)
  }

  applyCorrection(correction: PositionCorrection): void {
    const occurredOn = parseDate(correction.occurredOn)
    if ("state" in correction && correction.state === "UNOPENED") {
      const quantity =
        this.position.quantityMode === "UNITS" ? Decimal.parse("0") : undefined
      this.applyEconomicState(quantity, 0n, occurredOn)
      return
    }
    if (!("bookCostMinor" in correction)) throw invalidOperation()

    const currency = Currency.parse(this.position.currency)
    const quantity = correctedQuantity(
      this.position.quantityMode,
      correction.quantity
    )
    this.applyEconomicState(
      quantity,
      parseCost(correction.bookCostMinor, currency),
      occurredOn
    )
  }

  toSnapshot(): InvestmentPositionSnapshot {
    return {
      ...this.position,
      ...(this.position.quantity === undefined ? { quantity: undefined } : {}),
      ...(this.position.fixedIncomeTerms === undefined
        ? {}
        : { fixedIncomeTerms: { ...this.position.fixedIncomeTerms } }),
    }
  }

  private applyQuantityDelta(delta: string | undefined): Decimal | undefined {
    if (this.position.quantityMode === "AMOUNT") {
      if (delta !== undefined) throw invalidOperation()
      return undefined
    }
    const current = Decimal.parse(this.position.quantity ?? "0")
    return delta === undefined ? current : current.add(parseDecimal(delta))
  }

  private applyEconomicState(
    quantity: Decimal | undefined,
    cost: bigint,
    occurredOn: LocalDate
  ): void {
    if (cost < 0n) throw invalidOperation()
    const status = deriveStatus(this.position.quantityMode, quantity, cost)
    const economicChanged =
      cost !== currentCost(this.position) ||
      (quantity?.toString() ?? undefined) !== this.position.quantity
    const previousStatus = this.position.status
    this.position = {
      ...this.position,
      ...(quantity === undefined
        ? { quantity: undefined }
        : { quantity: quantity.toString() }),
      bookCostMinor: cost.toString(),
      status,
      ...(status === "CLOSED"
        ? {
            closedOn:
              previousStatus === "CLOSED"
                ? this.position.closedOn
                : occurredOn.toString(),
          }
        : { closedOn: undefined }),
      allocationRevision: economicChanged
        ? nextRevision(this.position.allocationRevision)
        : this.position.allocationRevision,
      allocationEffectiveOn: economicChanged
        ? occurredOn.toString()
        : this.position.allocationEffectiveOn,
      version: nextVersion(this.version),
    }
    this.record(
      previousStatus === "CLOSED" && status === "OPEN"
        ? "InvestmentPositionReopened"
        : previousStatus === "OPEN" && status === "CLOSED"
          ? "InvestmentPositionClosed"
          : "InvestmentPositionChanged"
    )
  }

  private record(type: string): void {
    this.recordFact({
      type,
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.toSnapshot(),
    })
  }

  private assertEntitiesActive(
    investmentAccountActive: boolean,
    instrumentActive: boolean
  ): void {
    if (!investmentAccountActive || !instrumentActive) throw inactiveEntity()
  }
}

function openingQuantity(
  mode: InvestmentQuantityMode,
  value: string | undefined
): Decimal | undefined {
  if (mode === "AMOUNT") {
    if (value !== undefined) throw invalidOperation()
    return undefined
  }
  if (value === undefined) throw invalidOperation()
  const quantity = parseDecimal(value)
  if (quantity.compare(Decimal.parse("0")) <= 0) throw invalidOperation()
  return quantity
}

function restoredQuantity(
  mode: InvestmentQuantityMode,
  value: string | undefined
): Decimal | undefined {
  if (mode === "AMOUNT") {
    if (value !== undefined) throw invalidOperation()
    return undefined
  }
  if (value === undefined) throw invalidOperation()
  const quantity = parseDecimal(value)
  if (quantity.compare(Decimal.parse("0")) < 0) throw invalidOperation()
  return quantity
}

function correctedQuantity(
  mode: InvestmentQuantityMode,
  value: string | undefined
): Decimal | undefined {
  if (mode === "AMOUNT") {
    if (value !== undefined) throw invalidOperation()
    return undefined
  }
  if (value === undefined) throw invalidOperation()
  const quantity = parseDecimal(value)
  if (quantity.compare(Decimal.parse("0")) < 0) throw invalidOperation()
  return quantity
}

function deriveStatus(
  mode: InvestmentQuantityMode,
  quantity: Decimal | undefined,
  cost: bigint
): InvestmentPositionStatus {
  if (mode === "AMOUNT") return cost === 0n ? "CLOSED" : "OPEN"
  if (quantity === undefined || quantity.compare(Decimal.parse("0")) < 0)
    throw invalidOperation()
  if (quantity.compare(Decimal.parse("0")) === 0 && cost > 0n)
    throw invalidOperation()
  return quantity.compare(Decimal.parse("0")) === 0 && cost === 0n
    ? "CLOSED"
    : "OPEN"
}

function parseCost(value: string, currency: Currency): bigint {
  if (!/^-?\d+$/.test(value)) throw invalidOperation()
  try {
    return assertInvestmentMoneyRange(Money.of(BigInt(value), currency))
      .amountMinor
  } catch {
    throw invalidOperation()
  }
}

function currentCost(snapshot: InvestmentPositionSnapshot): bigint {
  return BigInt(snapshot.bookCostMinor)
}

function parseDecimal(value: string): Decimal {
  try {
    return Decimal.parse(value)
  } catch {
    throw invalidOperation()
  }
}

function parseDate(value: string): LocalDate {
  try {
    return LocalDate.parse(value)
  } catch {
    throw invalidOperation()
  }
}

function normalizeLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const label = value.trim()
  if (label.length === 0) return undefined
  if (label.length > 120) throw invalidInput()
  return label
}

function nextVersion(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value === Number.MAX_SAFE_INTEGER
  )
    throw invalidOperation()
  return value + 1
}

function nextRevision(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value === Number.MAX_SAFE_INTEGER
  )
    throw invalidOperation()
  return value + 1
}

function invalidOperation(): DomainError {
  return new DomainError(
    "INVALID_INVESTMENT_OPERATION",
    "Investment position allocation is invalid"
  )
}

function invalidInput(): DomainError {
  return new DomainError(
    "INVALID_INVESTMENT_INPUT",
    "Investment position metadata is invalid"
  )
}

function inactiveEntity(): DomainError {
  return new DomainError(
    "INVESTMENT_ENTITY_NOT_ACTIVE",
    "Investment account and instrument must be active"
  )
}
