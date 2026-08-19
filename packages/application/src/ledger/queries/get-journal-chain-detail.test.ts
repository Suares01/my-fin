import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import type {
  FinancialBookRepository,
  JournalViewQueries,
} from "../../ports/index.js"
import { GetJournalChainDetail } from "./get-journal-chain-detail.js"

function handler() {
  const books = {
    findById: vi.fn().mockResolvedValue({}),
  } as unknown as FinancialBookRepository
  const queries = {
    getJournalChainDetail: vi.fn().mockResolvedValue(null),
  } as unknown as JournalViewQueries
  return { execute: new GetJournalChainDetail(books, queries), books, queries }
}

const detail = {
  chainId: "root-1",
  presentedEntryId: "entry-2",
  presentedVersion: 1,
  type: "EXPENSE" as const,
  status: "EDITED" as const,
  occurredOn: "2026-08-04",
  recordedAt: "2026-08-04T12:00:02.000Z",
  sequence: "12",
  description: "Groceries corrected",
  origin: "MANUAL" as const,
  amountMinor: "-1250",
  currency: "BRL",
  financialAccounts: [
    { id: "account-1", name: "Checking", kind: "ASSET" as const },
  ],
  categories: [{ id: "category-1", name: "Food", kind: "EXPENSE" as const }],
  postings: [
    {
      id: "posting-2",
      account: { id: "account-1", name: "Checking", kind: "ASSET" as const },
      amountMinor: "-1250",
      currency: "BRL",
      position: 0,
    },
  ],
  history: [
    {
      entryId: "entry-1",
      role: "ORIGINAL" as const,
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T12:00:00.000Z",
      sequence: "10",
      description: "Groceries",
      postings: [],
    },
    {
      entryId: "entry-reversal",
      role: "REVERSAL" as const,
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T12:00:01.000Z",
      sequence: "11",
      description: "Reverse groceries",
      postings: [],
    },
    {
      entryId: "entry-2",
      role: "REPLACEMENT" as const,
      occurredOn: "2026-08-04",
      recordedAt: "2026-08-04T12:00:02.000Z",
      sequence: "12",
      description: "Groceries corrected",
      postings: [],
    },
  ],
}

describe("GetJournalChainDetail", () => {
  it("returns the exact detail payload including history and postings", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getJournalChainDetail).mockResolvedValue(detail)

    const result = await execute.execute({
      bookId: "book-1",
      entryId: "entry-2",
    })

    expect(result).toEqual(Result.ok(detail))
    if (result.ok) {
      expect(result.value.presentedEntryId).toBe("entry-2")
      expect(result.value.presentedVersion).toBe(1)
      expect(result.value.amountMinor).toBe("-1250")
      expect(result.value.categories[0]?.kind).toBe("EXPENSE")
      expect(result.value.postings[0]?.amountMinor).toBe("-1250")
      expect(result.value.postings[0]?.account.name).toBe("Checking")
      expect(result.value.history.map((item) => item.role)).toEqual([
        "ORIGINAL",
        "REVERSAL",
        "REPLACEMENT",
      ])
    }
  })

  it("resolves a member ID with the requested book scope", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getJournalChainDetail).mockResolvedValue(detail)

    await execute.execute({ bookId: "book-1", entryId: "entry-reversal" })

    expect(vi.mocked(queries.getJournalChainDetail)).toHaveBeenCalledWith({
      bookId: "book-1",
      entryId: "entry-reversal",
    })
  })

  it.each([
    ["missing book", { bookId: "book-2", entryId: "entry-1" }],
    ["missing entry", { bookId: "book-1", entryId: "entry-missing" }],
    ["cross-book entry", { bookId: "book-1", entryId: "entry-other-book" }],
  ])("returns a stable not-found error for a %s", async (label, input) => {
    const { execute, books, queries } = handler()
    if (label === "missing book") {
      vi.mocked(books.findById).mockResolvedValue(null)
    }
    vi.mocked(queries.getJournalChainDetail).mockResolvedValue(null)

    const result = await execute.execute(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("ENTITY_NOT_FOUND")
      expect(result.error.message).toContain("was not found")
    }
    if (label === "missing book") {
      expect(queries.getJournalChainDetail).not.toHaveBeenCalled()
    }
  })

  it.each([
    ["book", { bookId: " ", entryId: "entry-1" }],
    ["entry", { bookId: "book-1", entryId: " " }],
  ])(
    "rejects an invalid %s before accessing either port",
    async (_label, input) => {
      const { execute, books, queries } = handler()

      const result = await execute.execute(input)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
      expect(books.findById).not.toHaveBeenCalled()
      expect(queries.getJournalChainDetail).not.toHaveBeenCalled()
    }
  )

  it("sanitizes unexpected detail query failures", async () => {
    const { execute, queries } = handler()
    vi.mocked(queries.getJournalChainDetail).mockRejectedValue(
      new Error("SQL SELECT secret /book/private.sqlite")
    )

    const result = await execute.execute({
      bookId: "book-1",
      entryId: "entry-1",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ERROR")
      expect(result.error.message).toBe("Financial query failed")
    }
  })

  it("preserves a cancelled detail state and omits no payload fields", async () => {
    const { execute, queries } = handler()
    const cancelled = {
      ...detail,
      status: "CANCELLED" as const,
      presentedEntryId: "entry-1",
    }
    vi.mocked(queries.getJournalChainDetail).mockResolvedValue(cancelled)

    const result = await execute.execute({
      bookId: "book-1",
      entryId: "entry-1",
    })

    expect(result).toEqual(Result.ok(cancelled))
    if (result.ok) {
      expect(result.value.status).toBe("CANCELLED")
      expect(result.value.chainId).toBe("root-1")
      expect(result.value.history[1]?.role).toBe("REVERSAL")
    }
  })

  it("preserves transfer endpoints and its category-free payload", async () => {
    const { execute, queries } = handler()
    const transfer = {
      ...detail,
      type: "TRANSFER" as const,
      status: "ACTIVE" as const,
      categories: [],
      transfer: {
        source: { id: "account-1", name: "Checking", kind: "ASSET" as const },
        destination: {
          id: "account-2",
          name: "Savings",
          kind: "ASSET" as const,
        },
      },
    }
    vi.mocked(queries.getJournalChainDetail).mockResolvedValue(transfer)

    const result = await execute.execute({
      bookId: "book-1",
      entryId: "entry-1",
    })

    expect(result).toEqual(Result.ok(transfer))
    if (result.ok) {
      expect(result.value.type).toBe("TRANSFER")
      expect(result.value.categories).toEqual([])
      expect(result.value.transfer?.source.id).toBe("account-1")
      expect(result.value.transfer?.destination.id).toBe("account-2")
    }
  })
})
