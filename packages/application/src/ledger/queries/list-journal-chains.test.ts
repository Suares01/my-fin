import { Result } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"
import type {
  Clock,
  FinancialBookRepository,
  JournalViewQueries,
} from "../../ports/index.js"
import { ListJournalChains } from "./list-journal-chains.js"

const chain = {
  chainId: "root-1",
  presentedEntryId: "entry-1",
  presentedVersion: 2,
  type: "EXPENSE" as const,
  status: "EDITED" as const,
  occurredOn: "2026-08-04",
  recordedAt: "2026-08-04T12:00:00.000Z",
  sequence: "9007199254740993",
  description: "Groceries",
  origin: "MANUAL" as const,
  amountMinor: "1000",
  currency: "BRL",
  financialAccounts: [],
  categories: [],
}

function handler(today = "2026-08-05") {
  const books = {
    findById: vi.fn().mockResolvedValue({ timezone: "America/Sao_Paulo" }),
  } as unknown as FinancialBookRepository
  const queries = {
    listJournalChains: vi.fn().mockResolvedValue([chain]),
  } as unknown as JournalViewQueries
  const clock = {
    now: vi.fn(),
    localDate: vi.fn().mockReturnValue(today),
  } satisfies Clock
  return {
    execute: new ListJournalChains(books, queries, clock),
    books,
    queries,
    clock,
  }
}

describe("ListJournalChains", () => {
  it("returns every chain from an explicit inclusive period without a continuation", async () => {
    const { execute, queries } = handler()
    const items = [chain, { ...chain, chainId: "root-2" }]
    vi.mocked(queries.listJournalChains).mockResolvedValue(items)

    await expect(
      execute.execute({
        bookId: "book-1",
        from: "2026-08-01",
        to: "2026-08-31",
      })
    ).resolves.toEqual(Result.ok(items))
    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith({
      bookId: "book-1",
      from: expect.objectContaining({ value: "2026-08-01" }),
      to: expect.objectContaining({ value: "2026-08-31" }),
    })
  })

  it("uses the complete current month in the book timezone when no period is supplied", async () => {
    const { execute, queries, clock } = handler("2026-02-11")

    await execute.execute({ bookId: "book-1" })

    expect(clock.localDate).toHaveBeenCalledWith("America/Sao_Paulo")
    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith({
      bookId: "book-1",
      from: expect.objectContaining({ value: "2026-02-01" }),
      to: expect.objectContaining({ value: "2026-02-28" }),
    })
  })

  it("uses February 29 for a leap-year current month", async () => {
    const { execute, queries } = handler("2024-02-11")

    await execute.execute({ bookId: "book-1" })

    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ value: "2024-02-29" }),
      })
    )
  })

  it("forwards normalized filters with the explicit period", async () => {
    const { execute, queries } = handler()

    await execute.execute({
      bookId: "book-1",
      from: "2026-08-01",
      to: "2026-08-04",
      accountIds: [" account-1 "],
      categoryIds: ["category-1"],
      types: ["EXPENSE"],
      origins: ["MANUAL"],
      search: " SALARY ",
    })

    expect(vi.mocked(queries.listJournalChains)).toHaveBeenCalledWith({
      bookId: "book-1",
      from: expect.objectContaining({ value: "2026-08-01" }),
      to: expect.objectContaining({ value: "2026-08-04" }),
      accountIds: ["account-1"],
      categoryIds: ["category-1"],
      types: ["EXPENSE"],
      origins: ["MANUAL"],
      search: "salary",
    })
  })

  it.each([
    ["bad book", { bookId: " " }],
    ["bad date", { from: "2026-02-30", to: "2026-02-30" }],
    ["partial period", { from: "2026-08-01" }],
    ["bad account", { accountIds: [] }],
    ["bad category", { categoryIds: [] }],
    ["bad type", { types: ["OTHER"] }],
    ["bad origin", { origins: ["IMPORT"] }],
    ["bad search", { search: "   " }],
  ])("rejects %s before accessing either port", async (_label, input) => {
    const { execute, books, queries } = handler()

    const result = await execute.execute({ bookId: "book-1", ...input })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INVALID_QUERY")
    expect(books.findById).not.toHaveBeenCalled()
    expect(queries.listJournalChains).not.toHaveBeenCalled()
  })

  it("returns ENTITY_NOT_FOUND for a missing book", async () => {
    const { execute, books, queries } = handler()
    vi.mocked(books.findById).mockResolvedValue(null)

    const result = await execute.execute({ bookId: "book-2" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("ENTITY_NOT_FOUND")
    expect(queries.listJournalChains).not.toHaveBeenCalled()
  })
})
