import type {
  BookId,
  InvestmentOperationId,
  InvestmentPositionId,
  JournalEntryId,
  LedgerAccountId,
} from "../../shared/identity/ids.js"
import { Currency } from "../../shared/identity/currency.js"
import { AggregateRoot } from "../../shared/kernel/aggregate-root.js"
import { DomainError } from "../../shared/kernel/domain-error.js"

export type InvestmentOperationType =
  | "OPENING_ALLOCATION"
  | "APPLICATION"
  | "PURCHASE"
  | "SALE"
  | "REDEMPTION"
  | "INCOME"
  | "AMORTIZATION"
  | "FEE"
  | "TAX"
export type InvestmentOperationRole = "BUSINESS" | "REVERSAL"
export type InvestmentCashMode = "NONE" | "INTERNAL_CASH" | "EXTERNAL_ACCOUNT"
export interface InvestmentCategoryRefs {
  readonly gainCategoryId?: string
  readonly lossCategoryId?: string
  readonly incomeCategoryId?: string
  readonly feeCategoryId?: string
  readonly taxCategoryId?: string
}
export type PositionEconomicState =
  | { readonly kind: "UNOPENED" }
  | {
      readonly kind: "EXISTING"
      readonly quantity?: string
      readonly bookCostMinor: string
      readonly status: "OPEN" | "CLOSED"
      readonly openedOn: string
      readonly closedOn?: string
      readonly allocationEffectiveOn: string
    }
export interface InvestmentOperationSnapshot {
  readonly id: InvestmentOperationId
  readonly bookId: BookId
  readonly positionId: InvestmentPositionId
  readonly type: InvestmentOperationType
  readonly role: InvestmentOperationRole
  readonly occurredOn: string
  readonly settledOn?: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly currency: string
  readonly quantityDelta?: string
  readonly bookCostDeltaMinor: string
  readonly grossAmountMinor: string
  readonly feesMinor: string
  readonly taxesMinor: string
  readonly netCashFlowMinor: string
  readonly cashMode: InvestmentCashMode
  readonly settlementAccountId?: LedgerAccountId
  readonly categories: InvestmentCategoryRefs
  readonly positionBefore: PositionEconomicState
  readonly journalEntryId?: JournalEntryId
  readonly reversalOf?: InvestmentOperationId
  readonly reversedBy?: InvestmentOperationId
  readonly replacementOf?: InvestmentOperationId
  readonly replacedBy?: InvestmentOperationId
  readonly version: number
}
export type RecordInvestmentOperationInput = Omit<
  InvestmentOperationSnapshot,
  | "role"
  | "reversalOf"
  | "reversedBy"
  | "replacementOf"
  | "replacedBy"
  | "version"
>

export class InvestmentOperation extends AggregateRoot<
  InvestmentOperationId,
  InvestmentOperationSnapshot
> {
  private constructor(private operation: InvestmentOperationSnapshot) {
    super(operation.id)
  }
  static record(input: RecordInvestmentOperationInput): InvestmentOperation {
    const operation = new InvestmentOperation(
      normalize({ ...input, role: "BUSINESS", version: 0 })
    )
    operation.record("InvestmentOperationRecorded")
    return operation
  }
  static restore(snapshot: InvestmentOperationSnapshot): InvestmentOperation {
    return new InvestmentOperation(normalize(snapshot))
  }
  static lastEffective(
    operations: readonly InvestmentOperation[]
  ): InvestmentOperation | undefined {
    return operations
      .filter((operation) => operation.isEffective())
      .sort((left, right) => {
        const leftSnapshot = left.toSnapshot()
        const rightSnapshot = right.toSnapshot()
        return leftSnapshot.occurredOn === rightSnapshot.occurredOn
          ? BigInt(leftSnapshot.sequence) < BigInt(rightSnapshot.sequence)
            ? 1
            : -1
          : leftSnapshot.occurredOn < rightSnapshot.occurredOn
            ? 1
            : -1
      })[0]
  }
  static createReversal(input: {
    readonly id: InvestmentOperationId
    readonly original: InvestmentOperationSnapshot
    readonly recordedAt: string
    readonly sequence: string
    readonly journalEntryId?: JournalEntryId
  }): InvestmentOperation {
    const original = normalize(input.original)
    if (original.role !== "BUSINESS") throw invalidOperation()
    const reversal = new InvestmentOperation(
      normalize({
        ...original,
        id: input.id,
        role: "REVERSAL",
        recordedAt: input.recordedAt,
        sequence: input.sequence,
        quantityDelta:
          original.quantityDelta === undefined
            ? undefined
            : negateDecimal(original.quantityDelta),
        bookCostDeltaMinor: negateInteger(original.bookCostDeltaMinor),
        netCashFlowMinor: negateInteger(original.netCashFlowMinor),
        reversalOf: original.id,
        ...(input.journalEntryId === undefined
          ? {}
          : { journalEntryId: input.journalEntryId }),
        version: 0,
      })
    )
    reversal.record("InvestmentOperationReversed")
    return reversal
  }
  get version(): number {
    return this.operation.version
  }
  isEffective(): boolean {
    return (
      this.operation.role === "BUSINESS" &&
      this.operation.reversedBy === undefined &&
      this.operation.replacedBy === undefined
    )
  }
  markReversedBy(id: InvestmentOperationId): void {
    this.link("reversedBy", id, "InvestmentOperationReversed")
  }
  markReplacedBy(id: InvestmentOperationId): void {
    this.link("replacedBy", id, "InvestmentOperationAmended")
  }
  toSnapshot(): InvestmentOperationSnapshot {
    return {
      ...this.operation,
      categories: { ...this.operation.categories },
      positionBefore: cloneState(this.operation.positionBefore),
    }
  }
  private link(
    field: "reversedBy" | "replacedBy",
    id: InvestmentOperationId,
    fact: string
  ): void {
    const current = this.operation[field]
    if (current === id) return
    if (current !== undefined || this.operation.role !== "BUSINESS")
      throw invalidOperation()
    this.operation = {
      ...this.operation,
      [field]: id,
      version: nextVersion(this.version),
    }
    this.record(fact)
  }
  private record(type: string): void {
    this.recordFact({
      type,
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.toSnapshot(),
    })
  }
}

function normalize(
  value: InvestmentOperationSnapshot
): InvestmentOperationSnapshot {
  Currency.parse(value.currency)
  validDate(value.occurredOn)
  validTimestamp(value.recordedAt)
  if (value.settledOn !== undefined) validDate(value.settledOn)
  validSequence(value.sequence)
  if (!Number.isSafeInteger(value.version) || value.version < 0)
    throw invalidOperation()
  const integers = [
    value.bookCostDeltaMinor,
    value.grossAmountMinor,
    value.feesMinor,
    value.taxesMinor,
    value.netCashFlowMinor,
  ]
  if (integers.some((item) => !/^-?\d+$/.test(item))) throw invalidOperation()
  if (
    value.quantityDelta !== undefined &&
    !/^-?\d+(?:\.\d+)?$/.test(value.quantityDelta)
  )
    throw invalidOperation()
  if (value.description.trim().length === 0) throw invalidOperation()
  return {
    ...value,
    description: value.description.trim(),
    categories: { ...value.categories },
    positionBefore: cloneState(value.positionBefore),
  }
}
function cloneState(state: PositionEconomicState): PositionEconomicState {
  return state.kind === "UNOPENED" ? { kind: "UNOPENED" } : { ...state }
}
function negateInteger(value: string): string {
  return (BigInt(value) * -1n).toString()
}
function negateDecimal(value: string): string {
  return value.startsWith("-") ? value.slice(1) : `-${value}`
}
function validDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalidOperation()
}
function validTimestamp(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
    throw invalidOperation()
}
function validSequence(value: string): void {
  if (!/^[1-9]\d*$/.test(value)) throw invalidOperation()
}
function nextVersion(value: number): number {
  if (value === Number.MAX_SAFE_INTEGER) throw invalidOperation()
  return value + 1
}
function invalidOperation(): DomainError {
  return new DomainError(
    "INVALID_INVESTMENT_OPERATION",
    "Investment operation is invalid"
  )
}
