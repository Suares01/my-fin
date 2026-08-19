import { DomainError } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import { ApplicationError } from "../ports/errors.js"
import type { LedgerAccountRepository, LedgerQueries } from "../ports/index.js"
import { GetAccountBalance } from "../ledger/queries/get-account-balance.js"
import { toQueryApplicationError } from "./query-error.js"

const accountRepository = {
  findById: async () => ({ bookId: "book-1" }),
} as unknown as LedgerAccountRepository

describe("toQueryApplicationError", () => {
  it("preserves an existing ApplicationError", () => {
    const error = new ApplicationError("ENTITY_NOT_FOUND", "Not found")
    expect(toQueryApplicationError(error)).toBe(error)
  })

  it("preserves a DomainError code and public message", () => {
    const error = toQueryApplicationError(
      new DomainError("INVALID_DATE", "Invalid date")
    )
    expect(error.code).toBe("INVALID_DATE")
    expect(error.message).toBe("Invalid date")
  })

  it("sanitizes an Error into the stable query failure", () => {
    const error = toQueryApplicationError(
      new Error(
        "SQLITE_ERROR: SELECT secret FROM /private/ledger.db with params"
      )
    )
    expect(error.code).toBe("UNEXPECTED_ERROR")
    expect(error.message).toBe("Financial query failed")
    expect(error.message).not.toContain("SQLITE")
    expect(error.message).not.toContain("/private/ledger.db")
  })

  it("sanitizes non-Error thrown values", () => {
    const error = toQueryApplicationError({
      driver: "sqlite",
      sql: "SELECT secret",
    })
    expect(error.code).toBe("UNEXPECTED_ERROR")
    expect(error.message).toBe("Financial query failed")
  })
})

describe("legacy query handlers", () => {
  it("sanitizes a balance adapter failure without exposing driver details", async () => {
    const queries = {
      getAccountBalance: async () => {
        throw new Error("SQLITE_ERROR at /private/ledger.db: SELECT secret")
      },
    } as unknown as LedgerQueries

    const result = await new GetAccountBalance(
      accountRepository,
      queries
    ).execute({
      bookId: "book-1",
      accountId: "account-1",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
    }
  })
})
