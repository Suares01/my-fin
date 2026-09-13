import { describe, expect, expectTypeOf, it } from "vitest"
import type { LedgerAccountId } from "@workspace/domain"
import type { RepositoryContext } from "./repositories.js"
import type {
  BookScopedLookup,
  InvestmentRequestStore,
  InvestmentSequenceStore,
  InvestmentTransactionReads,
  InvestmentValuationStore,
} from "./investment-repositories.js"

describe("investment persistence contracts", () => {
  it("discriminates found, missing and cross-book lookup", () => {
    const states: readonly BookScopedLookup<string>[] = [
      { kind: "FOUND", value: "value" },
      { kind: "NOT_FOUND" },
      { kind: "BOOK_MISMATCH" },
    ]
    expect(states.map((state) => state.kind)).toEqual([
      "FOUND",
      "NOT_FOUND",
      "BOOK_MISMATCH",
    ])
  })
  it("keeps request receipts scoped by book and request", () =>
    expectTypeOf<Parameters<InvestmentRequestStore["find"]>>().toEqualTypeOf<
      [string, string]
    >)
  it("keeps sequence allocation scoped by book", () =>
    expectTypeOf<Parameters<InvestmentSequenceStore["next"]>>().toEqualTypeOf<
      [string]
    >)
  it("makes valuations append-only", () =>
    expectTypeOf<InvestmentValuationStore>().toHaveProperty("append"))
  it("reads cash only from explicit account ids and date", () =>
    expectTypeOf<
      Parameters<InvestmentTransactionReads["accountCash"]>
    >().toEqualTypeOf<[string, readonly LedgerAccountId[], string]>())
  it("does not require investment ports in the legacy repository context", () =>
    expectTypeOf<RepositoryContext>().not.toHaveProperty("investmentPositions"))
})
