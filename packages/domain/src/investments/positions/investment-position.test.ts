import { describe, expect, it } from "vitest"
import {
  bookIdFromString,
  investmentInstrumentIdFromString,
  investmentPositionIdFromString,
  ledgerAccountIdFromString,
} from "../../shared/identity/ids.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { InvestmentPosition } from "./investment-position.js"

const input = (
  overrides: Partial<
    Parameters<typeof InvestmentPosition.openWithAllocation>[0]
  > = {}
) => ({
  id: investmentPositionIdFromString("position-1"),
  bookId: bookIdFromString("book-1"),
  investmentAccountId: ledgerAccountIdFromString("account-1"),
  instrumentId: investmentInstrumentIdFromString("instrument-1"),
  instrumentClass: "FIXED_INCOME" as const,
  quantityMode: "UNITS" as const,
  quantity: "10",
  bookCostMinor: "1000",
  currency: "BRL",
  openedOn: "2026-01-01",
  ...overrides,
})

describe("InvestmentPosition", () => {
  it("opens distinct positions for the same account and instrument", () => {
    const first = InvestmentPosition.openWithAllocation(input())
    const second = InvestmentPosition.openWithAllocation(
      input({ id: investmentPositionIdFromString("position-2") })
    )

    expect(first.id).not.toBe(second.id)
  })

  it("preserves the opening identities and quantity mode", () => {
    expect(
      InvestmentPosition.openWithAllocation(input()).toSnapshot()
    ).toMatchObject({
      bookId: bookIdFromString("book-1"),
      investmentAccountId: ledgerAccountIdFromString("account-1"),
      instrumentId: investmentInstrumentIdFromString("instrument-1"),
      quantityMode: "UNITS",
    })
  })

  it("opens units with a positive quantity and zero cost", () => {
    expect(
      InvestmentPosition.openWithAllocation(
        input({ bookCostMinor: "0" })
      ).toSnapshot()
    ).toMatchObject({ quantity: "10", bookCostMinor: "0", status: "OPEN" })
  })

  it("opens amount positions without a quantity", () => {
    expect(
      InvestmentPosition.openWithAllocation(
        input({ quantityMode: "AMOUNT", quantity: undefined })
      ).toSnapshot()
    ).toMatchObject({
      quantity: undefined,
      quantityMode: "AMOUNT",
      status: "OPEN",
    })
  })

  it.each([
    input({ quantity: undefined }),
    input({ quantity: "0" }),
    input({ quantityMode: "AMOUNT", quantity: "1" }),
    input({ quantityMode: "AMOUNT", quantity: undefined, bookCostMinor: "0" }),
    input({ quantity: "-1" }),
  ])("rejects an invalid opening allocation", (position) => {
    expectInvalid(() => InvestmentPosition.openWithAllocation(position))
  })

  it("starts with revision one independently from aggregate version", () => {
    expect(
      InvestmentPosition.openWithAllocation(input()).toSnapshot()
    ).toMatchObject({
      allocationRevision: 1,
      version: 0,
      allocationEffectiveOn: "2026-01-01",
    })
  })

  it("stores a normalized label and fixed-income terms at opening", () => {
    expect(
      InvestmentPosition.openWithAllocation(
        input({
          label: " Reserva ",
          fixedIncomeTerms: {
            rateKind: "INDEXED",
            index: "CDI",
            indexPercentage: "105",
          },
        })
      ).toSnapshot()
    ).toMatchObject({
      label: "Reserva",
      normalizedLabel: "reserva",
      fixedIncomeTerms: {
        rateKind: "INDEXED",
        index: "CDI",
        indexPercentage: "105",
      },
    })
  })

  it("updates only mutable metadata with one versioned fact", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.pullDomainFacts()
    position.updateLabel(" Viagem ")

    expect(position.toSnapshot()).toMatchObject({
      label: "Viagem",
      version: 1,
      allocationRevision: 1,
    })
    expect(position.pullDomainFacts()[0]?.type).toBe(
      "InvestmentPositionChanged"
    )
  })

  it("keeps a metadata no-op from changing version or revision", () => {
    const position = InvestmentPosition.openWithAllocation(
      input({ label: "Reserva" })
    )
    position.pullDomainFacts()
    position.updateLabel("Reserva")

    expect(position.toSnapshot()).toMatchObject({
      version: 0,
      allocationRevision: 1,
    })
    expect(position.pullDomainFacts()).toEqual([])
  })

  it("reduces only explicit units and cost on a partial sale", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-4",
      bookCostDeltaMinor: "-400",
      occurredOn: "2026-02-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      quantity: "6",
      bookCostMinor: "600",
      status: "OPEN",
    })
  })

  it("requires an explicit cost delta for an operation", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    expectInvalid(() => position.applyOperation({ occurredOn: "2026-02-01" }))
  })

  it("closes a units position when both quantity and cost reach zero", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-10",
      bookCostDeltaMinor: "-1000",
      occurredOn: "2026-02-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      status: "CLOSED",
      closedOn: "2026-02-01",
    })
  })

  it("closes an amount position when cost reaches zero", () => {
    const position = InvestmentPosition.openWithAllocation(
      input({ quantityMode: "AMOUNT", quantity: undefined })
    )
    position.applyOperation({
      bookCostDeltaMinor: "-1000",
      occurredOn: "2026-02-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      status: "CLOSED",
      closedOn: "2026-02-01",
    })
  })

  it("rejects zero units with a positive remaining cost", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    expectInvalid(() =>
      position.applyOperation({
        quantityDelta: "-10",
        bookCostDeltaMinor: "-400",
        occurredOn: "2026-02-01",
      })
    )
  })

  it("keeps units unchanged for an amortization-like cost-only operation", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      bookCostDeltaMinor: "-200",
      occurredOn: "2026-02-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      quantity: "10",
      bookCostMinor: "800",
    })
  })

  it("increments revision exactly once for an economic change", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-1",
      bookCostDeltaMinor: "-100",
      occurredOn: "2026-02-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      allocationRevision: 2,
      version: 1,
      allocationEffectiveOn: "2026-02-01",
    })
  })

  it("increments version but not revision for a non-economic operation", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      bookCostDeltaMinor: "0",
      occurredOn: "2026-02-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      allocationRevision: 1,
      version: 1,
      allocationEffectiveOn: "2026-01-01",
    })
  })

  it("uses correction final state once instead of publishing an intermediate revision", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyCorrection({
      quantity: "6",
      bookCostMinor: "600",
      occurredOn: "2026-03-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      allocationRevision: 2,
      version: 1,
      quantity: "6",
      bookCostMinor: "600",
    })
  })

  it("keeps revision when a correction preserves final allocation", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyCorrection({
      quantity: "10",
      bookCostMinor: "1000",
      occurredOn: "2026-03-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      allocationRevision: 1,
      version: 1,
      allocationEffectiveOn: "2026-01-01",
    })
  })

  it("creates a new revision when cancellation restores a historical allocation", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-4",
      bookCostDeltaMinor: "-400",
      occurredOn: "2026-02-01",
    })
    position.applyCorrection({
      quantity: "10",
      bookCostMinor: "1000",
      occurredOn: "2026-03-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      allocationRevision: 3,
      allocationEffectiveOn: "2026-03-01",
    })
  })

  it("reopens a closed position through correction and removes closedOn", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-10",
      bookCostDeltaMinor: "-1000",
      occurredOn: "2026-02-01",
    })
    position.applyCorrection({
      quantity: "10",
      bookCostMinor: "1000",
      occurredOn: "2026-03-01",
    })

    expect(position.toSnapshot()).toMatchObject({
      status: "OPEN",
      closedOn: undefined,
      allocationRevision: 3,
    })
  })

  it("keeps a cancelled opening as the historical closed position", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyCorrection({ state: "UNOPENED", occurredOn: "2026-02-01" })

    expect(position.toSnapshot()).toMatchObject({
      quantity: "0",
      bookCostMinor: "0",
      status: "CLOSED",
      closedOn: "2026-02-01",
    })
  })

  it.each([
    [false, true],
    [true, false],
  ])(
    "rejects a new allocation when an involved entity is inactive",
    (account, instrument) => {
      const position = InvestmentPosition.openWithAllocation(input())

      expectInactive(() => position.assertCanAllocate(account, instrument))
    }
  )

  it("rejects a new allocation for a closed position", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-10",
      bookCostDeltaMinor: "-1000",
      occurredOn: "2026-02-01",
    })

    expectInactive(() => position.assertCanAllocate(true, true))
  })

  it("allows post-closure cash-flow validation while both entities are active", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-10",
      bookCostDeltaMinor: "-1000",
      occurredOn: "2026-02-01",
    })

    expect(
      position.assertCanRecordPostClosureCashFlow(true, true)
    ).toBeUndefined()
  })

  it("rejects a correction that would reopen under an inactive entity", () => {
    const position = InvestmentPosition.openWithAllocation(input())
    position.applyOperation({
      quantityDelta: "-10",
      bookCostDeltaMinor: "-1000",
      occurredOn: "2026-02-01",
    })

    expectInactive(() => position.assertCanReopen(false, true))
  })

  it("restores without facts and clones nested fixed-income terms", () => {
    const position = InvestmentPosition.openWithAllocation(
      input({ fixedIncomeTerms: { rateKind: "PREFIXED", annualRate: "10" } })
    )
    const restored = InvestmentPosition.restore(position.toSnapshot())
    const snapshot = restored.toSnapshot()

    expect(restored.pullDomainFacts()).toEqual([])
    expect(snapshot.fixedIncomeTerms).toEqual({
      rateKind: "PREFIXED",
      annualRate: "10",
    })
    expect(snapshot.fixedIncomeTerms).not.toBe(
      position.toSnapshot().fixedIncomeTerms
    )
  })
})

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected position to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVALID_INVESTMENT_OPERATION")
  }
}

function expectInactive(action: () => unknown): void {
  try {
    action()
    throw new Error("expected inactive entity rejection")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVESTMENT_ENTITY_NOT_ACTIVE")
  }
}
