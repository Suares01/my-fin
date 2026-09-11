import { describe, expect, it } from "vitest"
import {
  bookIdFromString,
  investmentOperationIdFromString,
  investmentPositionIdFromString,
} from "../../shared/identity/ids.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { InvestmentOperation } from "./investment-operation.js"

const input = (
  overrides: Partial<Parameters<typeof InvestmentOperation.record>[0]> = {}
) => ({
  id: investmentOperationIdFromString("operation-1"),
  bookId: bookIdFromString("book-1"),
  positionId: investmentPositionIdFromString("position-1"),
  type: "SALE" as const,
  occurredOn: "2026-01-02",
  recordedAt: "2026-01-02T12:00:00.000Z",
  sequence: "2",
  description: "Venda",
  currency: "BRL",
  quantityDelta: "-4",
  bookCostDeltaMinor: "-400",
  grossAmountMinor: "500",
  feesMinor: "10",
  taxesMinor: "20",
  netCashFlowMinor: "470",
  cashMode: "INTERNAL_CASH" as const,
  categories: {},
  positionBefore: {
    kind: "EXISTING" as const,
    quantity: "10",
    bookCostMinor: "1000",
    status: "OPEN" as const,
    openedOn: "2026-01-01",
    allocationEffectiveOn: "2026-01-01",
  },
  ...overrides,
})

describe("InvestmentOperation", () => {
  it("persists authoritative effects and state before the operation", () => {
    expect(InvestmentOperation.record(input()).toSnapshot()).toMatchObject({
      role: "BUSINESS",
      quantityDelta: "-4",
      bookCostDeltaMinor: "-400",
      netCashFlowMinor: "470",
      positionBefore: {
        kind: "EXISTING",
        quantity: "10",
        bookCostMinor: "1000",
      },
      version: 0,
    })
  })

  it("records an operation fact with the persisted book identity", () => {
    const operation = InvestmentOperation.record(input())
    expect(operation.pullDomainFacts()[0]).toMatchObject({
      type: "InvestmentOperationRecorded",
      aggregateId: "operation-1",
      aggregateVersion: 0,
    })
  })

  it("treats only an unlinked business operation as effective", () => {
    expect(InvestmentOperation.record(input()).isEffective()).toBe(true)
  })

  it("marks an original reversed once without changing its effects", () => {
    const operation = InvestmentOperation.record(input())
    operation.pullDomainFacts()
    operation.markReversedBy(investmentOperationIdFromString("reversal-1"))

    expect(operation.toSnapshot()).toMatchObject({
      reversedBy: "reversal-1",
      version: 1,
      quantityDelta: "-4",
      bookCostDeltaMinor: "-400",
    })
    expect(operation.isEffective()).toBe(false)
  })

  it("marks an original replaced once without changing original dates", () => {
    const operation = InvestmentOperation.record(input())
    operation.markReplacedBy(investmentOperationIdFromString("replacement-1"))

    expect(operation.toSnapshot()).toMatchObject({
      replacedBy: "replacement-1",
      occurredOn: "2026-01-02",
      recordedAt: "2026-01-02T12:00:00.000Z",
    })
  })

  it("does not change version for repeated identical lineage links", () => {
    const operation = InvestmentOperation.record(input())
    operation.markReversedBy(investmentOperationIdFromString("reversal-1"))
    operation.markReversedBy(investmentOperationIdFromString("reversal-1"))

    expect(operation.toSnapshot().version).toBe(1)
  })

  it("rejects changing an already linked lineage", () => {
    const operation = InvestmentOperation.record(input())
    operation.markReversedBy(investmentOperationIdFromString("reversal-1"))
    expectInvalid(() =>
      operation.markReversedBy(investmentOperationIdFromString("reversal-2"))
    )
  })

  it("creates a reversal with original occurrence and correction record time", () => {
    const original = InvestmentOperation.record(input())
    const reversal = InvestmentOperation.createReversal({
      id: investmentOperationIdFromString("reversal-1"),
      original: original.toSnapshot(),
      recordedAt: "2026-02-01T10:00:00.000Z",
      sequence: "3",
    })

    expect(reversal.toSnapshot()).toMatchObject({
      role: "REVERSAL",
      reversalOf: "operation-1",
      occurredOn: "2026-01-02",
      recordedAt: "2026-02-01T10:00:00.000Z",
      quantityDelta: "4",
      bookCostDeltaMinor: "400",
      netCashFlowMinor: "-470",
    })
  })

  it("preserves descriptive gross, fee and tax values on reversal", () => {
    const original = InvestmentOperation.record(input())
    const reversal = InvestmentOperation.createReversal({
      id: investmentOperationIdFromString("reversal-1"),
      original: original.toSnapshot(),
      recordedAt: "2026-02-01T10:00:00.000Z",
      sequence: "3",
    })

    expect(reversal.toSnapshot()).toMatchObject({
      grossAmountMinor: "500",
      feesMinor: "10",
      taxesMinor: "20",
    })
  })

  it("never treats a reversal as effective", () => {
    const original = InvestmentOperation.record(input())
    const reversal = InvestmentOperation.createReversal({
      id: investmentOperationIdFromString("reversal-1"),
      original: original.toSnapshot(),
      recordedAt: "2026-02-01T10:00:00.000Z",
      sequence: "3",
    })
    expect(reversal.isEffective()).toBe(false)
  })

  it("finds only the last unlinked business operation by date and sequence", () => {
    const older = InvestmentOperation.record(
      input({
        id: investmentOperationIdFromString("operation-0"),
        occurredOn: "2026-01-01",
        sequence: "1",
      })
    )
    const latest = InvestmentOperation.record(input())
    latest.markReversedBy(investmentOperationIdFromString("reversal-1"))

    expect(InvestmentOperation.lastEffective([older, latest])?.id).toBe(
      "operation-0"
    )
  })

  it.each(["0", "-1", "1.5"])(
    "rejects an invalid persisted sequence %s",
    (sequence) => {
      expectInvalid(() => InvestmentOperation.record(input({ sequence })))
    }
  )

  it.each(["", "2026-01-02", "not-a-date"])(
    "rejects an invalid recorded timestamp %s",
    (recordedAt) => {
      expectInvalid(() => InvestmentOperation.record(input({ recordedAt })))
    }
  )

  it("rejects a malformed signed delta", () => {
    expectInvalid(() =>
      InvestmentOperation.record(input({ bookCostDeltaMinor: "10.5" }))
    )
  })

  it("preserves optional settlement and journal references", () => {
    expect(
      InvestmentOperation.record(
        input({
          journalEntryId: "journal-1" as never,
          settlementAccountId: "account-2" as never,
        })
      ).toSnapshot()
    ).toMatchObject({
      journalEntryId: "journal-1",
      settlementAccountId: "account-2",
    })
  })

  it("clones categories and position-before state", () => {
    const operation = InvestmentOperation.record(
      input({
        categories: { gainCategoryId: "category-1" },
        positionBefore: { kind: "UNOPENED" },
      })
    )
    const snapshot = operation.toSnapshot()
    expect(snapshot.categories).toEqual({ gainCategoryId: "category-1" })
    expect(snapshot.positionBefore).toEqual({ kind: "UNOPENED" })
  })

  it("restores without new domain facts", () => {
    const operation = InvestmentOperation.restore(
      InvestmentOperation.record(input()).toSnapshot()
    )
    expect(operation.pullDomainFacts()).toEqual([])
  })
})

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected operation to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVALID_INVESTMENT_OPERATION")
  }
}
