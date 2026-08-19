import { Result } from "@workspace/domain"
import type {
  FinancialBookRepository,
  LedgerReadQueries,
} from "../../ports/index.js"
import { describe, expect, it, vi } from "vitest"
import { ListAccountBalances } from "./list-account-balances.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    listAccountBalances: vi.fn().mockResolvedValue([]),
  } as unknown as LedgerReadQueries
  return {
    execute: new ListAccountBalances(books, queries),
    books,
    queries,
  }
}

describe("ListAccountBalances", () => {
  it("returns the page and applies defaults before calling the port", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listAccountBalances).mockResolvedValue([
      {
        accountId: "asset-1",
        accountName: "Cash",
        accountKind: "ASSET",
        rawBalanceMinor: "100",
        displayBalanceMinor: "100",
        amountMinor: "100",
        currency: "BRL",
        asOf: null,
        archived: false,
      },
    ])

    const result = await execute.execute({ bookId: "book-1" })

    expect(result).toEqual(
      Result.ok({
        items: [
          expect.objectContaining({ accountId: "asset-1", amountMinor: "100" }),
        ],
        nextCursor: null,
      })
    )
    expect(queries.listAccountBalances).toHaveBeenCalledWith({
      bookId: "book-1",
      includeArchived: false,
      includeZeroBalance: true,
    })
  })

  it("parses kinds and the inclusive asOf date", async () => {
    const { execute, queries } = handler()

    const result = await execute.execute({
      bookId: "book-1",
      accountKinds: ["ASSET", "LIABILITY"],
      asOf: "2026-08-04",
      includeArchived: true,
      includeZeroBalance: false,
    })

    expect(result.ok).toBe(true)
    const call = vi.mocked(queries.listAccountBalances).mock.calls[0]?.[0]
    expect(call?.accountKinds).toEqual(["ASSET", "LIABILITY"])
    expect(call?.asOf?.value).toBe("2026-08-04")
    expect(call?.includeArchived).toBe(true)
    expect(call?.includeZeroBalance).toBe(false)
  })

  it("returns an empty page for an explicitly empty kind list", async () => {
    const { execute, queries } = handler()

    const result = await execute.execute({ bookId: "book-1", accountKinds: [] })

    expect(result).toEqual(Result.ok({ items: [], nextCursor: null }))
    expect(queries.listAccountBalances).not.toHaveBeenCalled()
  })

  it.each([
    ["bad-date", { asOf: "2026-02-30" }],
    ["bad-kind", { accountKinds: ["UNKNOWN"] }],
    ["missing-book", { bookId: "" }],
  ])("rejects %s without returning partial data", async (_label, input) => {
    const { execute, books, queries } = handler()

    const result = await execute.execute({ bookId: "book-1", ...input })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_QUERY")
    }
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.listAccountBalances).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND when the requested book is absent", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "book-2" })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    }
    expect(queries.listAccountBalances).not.toHaveBeenCalled()
  })

  it("sanitizes unexpected adapter failures", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listAccountBalances).mockRejectedValue(
      new Error("SQL SELECT secret=42 /tmp/private.db")
    )

    const result = await execute.execute({ bookId: "book-1" })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
      expect(result.error.message).not.toContain("secret")
    }
  })
})
