import { Result } from "@workspace/domain"
import type {
  LedgerAccountRepository,
  LedgerReadQueries,
} from "../../ports/index.js"
import { describe, expect, it, vi } from "vitest"
import { encodeStatementCursor } from "../../querying/cursor-codec.js"
import { ListAccountStatement } from "./list-account-statement.js"

function handler() {
  const accounts = {
    findById: vi.fn().mockResolvedValue({ bookId: "book-1" }),
  } as unknown as LedgerAccountRepository
  const queries = {
    listAccountStatement: vi
      .fn()
      .mockResolvedValue({ items: [], nextKey: null }),
  } as unknown as LedgerReadQueries
  return {
    execute: new ListAccountStatement(accounts, queries),
    accounts,
    queries,
  }
}

describe("ListAccountStatement", () => {
  it("returns items and encodes the opaque continuation cursor", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listAccountStatement).mockResolvedValue({
      items: [
        {
          entryId: "entry-1",
          postingId: "posting-1",
          occurredOn: "2026-08-04",
          recordedAt: "2026-08-04T12:00:00.000Z",
          sequence: "9007199254740993",
          description: "Movement",
          rawAmountMinor: "100",
          displayAmountMinor: "100",
          runningBalanceMinor: "100",
          currency: "BRL",
          origin: "MANUAL",
          counterpartyAccounts: [],
          isReversal: false,
          isReversed: false,
        },
      ],
      nextKey: {
        occurredOn: "2026-08-04",
        sequence: "9007199254740993",
        postingPosition: 0,
      },
    })

    const result = await execute.execute({
      bookId: "book-1",
      accountId: "account-1",
      from: "2026-08-01",
      to: "2026-08-04",
      limit: 1,
    })

    expect(result).toEqual(
      Result.ok({
        items: [
          expect.objectContaining({
            entryId: "entry-1",
            runningBalanceMinor: "100",
          }),
        ],
        nextCursor: encodeStatementCursor({
          occurredOn: "2026-08-04",
          sequence: "9007199254740993",
          postingPosition: 0,
        }),
      })
    )
    const call = vi.mocked(queries.listAccountStatement).mock.calls[0]?.[0]
    expect(call?.accountId).toBe("account-1")
    expect(call?.limit).toBe(1)
    expect(call?.cursor).toBeUndefined()
  })

  it("decodes a cursor and preserves the validated range", async () => {
    const { execute, queries } = handler()
    const cursor = encodeStatementCursor({
      occurredOn: "2026-08-04",
      sequence: "10",
      postingPosition: 2,
    })

    const result = await execute.execute({
      bookId: "book-1",
      accountId: "account-1",
      from: "2026-08-01",
      to: "2026-08-04",
      limit: 10,
      cursor,
    })

    expect(result.ok).toBe(true)
    const call = vi.mocked(queries.listAccountStatement).mock.calls[0]?.[0]
    expect(call?.from?.value).toBe("2026-08-01")
    expect(call?.to?.value).toBe("2026-08-04")
    expect(call?.cursor).toEqual({
      occurredOn: "2026-08-04",
      sequence: "10",
      postingPosition: 2,
    })
  })

  it.each([
    ["inverted range", { from: "2026-08-05", to: "2026-08-04", limit: 10 }],
    ["bad limit", { limit: 0 }],
    ["bad cursor", { limit: 10, cursor: "j1.2026-08-04.10" }],
  ])("rejects %s before calling the port", async (_label, input) => {
    const { execute, accounts, queries } = handler()

    const result = await execute.execute({
      bookId: "book-1",
      accountId: "account-1",
      ...input,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(accounts.findById).not.toHaveBeenCalled()
    expect(queries.listAccountStatement).not.toHaveBeenCalled()
  })

  it("hides an absent or cross-book account", async () => {
    const { execute, accounts, queries } = handler()
    vi.mocked(accounts.findById).mockResolvedValue({
      bookId: "book-2",
    } as never)

    const result = await execute.execute({
      bookId: "book-1",
      accountId: "account-1",
      limit: 10,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.listAccountStatement).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for an absent account without returning items", async () => {
    const { execute, accounts, queries } = handler()
    vi.mocked(accounts.findById).mockResolvedValue(null)

    const result = await execute.execute({
      bookId: "book-1",
      accountId: "missing",
      limit: 10,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("ENTITY_NOT_FOUND")
      expect(result.error.message).toContain("missing")
    }
    expect(queries.listAccountStatement).not.toHaveBeenCalled()
  })

  it("sanitizes adapter failures without leaking driver details", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.listAccountStatement).mockRejectedValue(
      new Error("SQL parameters and /private/ledger.sqlite")
    )

    const result = await execute.execute({
      bookId: "book-1",
      accountId: "account-1",
      limit: 10,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
    }
  })
})
