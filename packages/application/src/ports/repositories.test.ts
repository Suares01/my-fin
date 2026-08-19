import type {
  BookId,
  LedgerAccountId,
  LedgerAccountKind,
} from "@workspace/domain"
import { describe, expectTypeOf, it } from "vitest"
import type { LedgerAccountRepository } from "./repositories.js"

const legacyExistsWithName: LedgerAccountRepository["existsWithName"] = async (
  _bookId: BookId,
  _kind: LedgerAccountKind,
  _normalizedName: string
) => {
  void _bookId
  void _kind
  void _normalizedName
  return false
}

describe("LedgerAccountRepository name lookup contract", () => {
  it("keeps book and kind scope while accepting an optional branded exclusion", () => {
    expectTypeOf<
      Parameters<LedgerAccountRepository["existsWithName"]>
    >().toEqualTypeOf<
      [
        bookId: BookId,
        kind: LedgerAccountKind,
        normalizedName: string,
        excludeAccountId?: LedgerAccountId,
      ]
    >()
    expectTypeOf(legacyExistsWithName).toMatchTypeOf<
      LedgerAccountRepository["existsWithName"]
    >()
  })
})
