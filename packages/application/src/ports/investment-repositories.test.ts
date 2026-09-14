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
  it("requires investment instrument persistence in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentInstruments"))
  it("requires investment position persistence in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentPositions"))
  it("requires investment operation persistence in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentOperations"))
  it("requires append-only valuations in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentValuations"))
  it("requires request receipts in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentRequests"))
  it("requires investment sequences in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentSequences"))
  it("requires transaction-scoped investment reads in the transaction context", () =>
    expectTypeOf<RepositoryContext>().toHaveProperty("investmentReads"))
})
