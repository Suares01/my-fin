import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SqliteJournalViewQueries } from "../../src/queries/sqlite-journal-view-queries.js"
import { SqliteLedgerQueries } from "../../src/queries/sqlite-ledger-queries.js"
import {
  createFinancialQueryScenario,
  type FinancialQueryScenario,
} from "../support/financial-query-scenario.js"

const bookId = "book-1" as never

describe("SqliteJournalViewQueries.listJournalChains", () => {
  let scenario: FinancialQueryScenario
  let queries: SqliteJournalViewQueries
  let checking: string
  let savings: string
  let food: string
  let salary: string
  let openingId: string
  let incomeId: string
  let expenseId: string
  let transferId: string

  beforeEach(async () => {
    scenario = await createFinancialQueryScenario()
    await scenario.createBook()
    checking = (await scenario.createFinancialAccount()).id
    savings = (await scenario.createFinancialAccount({ name: "Savings" })).id
    food = (await scenario.createExpenseCategory()).id
    salary = (await scenario.createIncomeCategory()).id
    openingId = await scenario.setOpeningBalance({
      accountId: checking,
      amountMinor: "10000",
      occurredOn: "2026-08-01",
      description: "Opening balance",
    })
    incomeId = await scenario.recordIncome({
      accountId: checking,
      categoryId: salary,
      amountMinor: "2500",
      occurredOn: "2026-08-02",
      description: "Salary",
    })
    expenseId = await scenario.recordExpense({
      accountId: checking,
      categoryId: food,
      amountMinor: "700",
      occurredOn: "2026-08-03",
      description: "Café lunch",
    })
    transferId = await scenario.transfer({
      sourceAccountId: checking,
      destinationAccountId: savings,
      amountMinor: "300",
      occurredOn: "2026-08-04",
      description: "Move funds",
    })
    queries = new SqliteJournalViewQueries(scenario.database)
  })

  afterEach(async () => {
    await scenario.close()
  })

  it("returns one consolidated row per business chain", async () => {
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([transferId, expenseId, incomeId, openingId])
    expect(result.items).toHaveLength(4)
  })

  it("classifies opening balance exactly", async () => {
    const result = await queries.listJournalChains({
      bookId,
      types: ["OPENING_BALANCE"],
      limit: 10,
    })

    expect(result.items[0]).toMatchObject({
      chainId: openingId,
      presentedEntryId: openingId,
      type: "OPENING_BALANCE",
      status: "ACTIVE",
      amountMinor: "10000",
      currency: "BRL",
    })
  })

  it("classifies income with a positive exact amount", async () => {
    const result = await queries.listJournalChains({
      bookId,
      types: ["INCOME"],
      limit: 10,
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        presentedEntryId: incomeId,
        type: "INCOME",
        amountMinor: "2500",
        categories: [{ id: salary, name: "Salary", kind: "INCOME" }],
      }),
    ])
  })

  it("classifies expense with current account and category summaries", async () => {
    const result = await queries.listJournalChains({
      bookId,
      types: ["EXPENSE"],
      limit: 10,
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        presentedEntryId: expenseId,
        type: "EXPENSE",
        amountMinor: "700",
        financialAccounts: [{ id: checking, name: "Checking", kind: "ASSET" }],
        categories: [{ id: food, name: "Food", kind: "EXPENSE" }],
      }),
    ])
  })

  it("classifies transfer with opposite endpoints and no category", async () => {
    const result = await queries.listJournalChains({
      bookId,
      types: ["TRANSFER"],
      limit: 10,
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        presentedEntryId: transferId,
        type: "TRANSFER",
        amountMinor: "300",
        categories: [],
        transfer: {
          source: { id: checking, name: "Checking", kind: "ASSET" },
          destination: { id: savings, name: "Savings", kind: "ASSET" },
        },
      }),
    ])
  })

  it("applies an inclusive lower date boundary to the presented entry", async () => {
    const result = await queries.listJournalChains({
      bookId,
      from: { value: "2026-08-03" } as never,
      limit: 10,
    })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([transferId, expenseId])
  })

  it("applies an inclusive upper date boundary to the presented entry", async () => {
    const result = await queries.listJournalChains({
      bookId,
      to: { value: "2026-08-02" } as never,
      limit: 10,
    })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([incomeId, openingId])
  })

  it("unions account IDs inside the account filter group", async () => {
    const result = await queries.listJournalChains({
      bookId,
      accountIds: [checking, savings] as never,
      limit: 10,
    })

    expect(result.items).toHaveLength(4)
    expect(
      result.items.every(
        ({ financialAccounts }) => financialAccounts.length > 0
      )
    ).toBe(true)
  })

  it("unions category IDs inside the category filter group", async () => {
    const result = await queries.listJournalChains({
      bookId,
      categoryIds: [food, salary] as never,
      limit: 10,
    })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([expenseId, incomeId])
  })

  it("intersects different filter groups", async () => {
    const result = await queries.listJournalChains({
      bookId,
      accountIds: [checking] as never,
      categoryIds: [food] as never,
      types: ["EXPENSE"],
      origins: ["MANUAL"],
      from: { value: "2026-08-03" } as never,
      to: { value: "2026-08-03" } as never,
      limit: 10,
    })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([expenseId])
  })

  it("accepts a SYSTEM origin filter without exposing technical reversals", async () => {
    const reversalId = await scenario.reverse({ journalEntryId: expenseId })
    const result = await queries.listJournalChains({
      bookId,
      origins: ["SYSTEM"],
      limit: 10,
    })

    expect(result.items).toEqual([])
    expect(
      result.items.some(
        ({ presentedEntryId }) => presentedEntryId === reversalId
      )
    ).toBe(false)
  })

  it("matches normalized search text case-insensitively", async () => {
    const result = await queries.listJournalChains({
      bookId,
      search: "café",
      limit: 10,
    })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([expenseId])
  })

  it("preserves accent distinctions in search", async () => {
    const unaccented = await scenario.recordExpense({
      accountId: checking,
      categoryId: food,
      amountMinor: "50",
      occurredOn: "2026-08-04",
      description: "Cafe lunch",
    })
    const result = await queries.listJournalChains({
      bookId,
      search: "cafe",
      limit: 10,
    })

    expect(
      result.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([unaccented])
    expect(
      result.items.some(
        ({ presentedEntryId }) => presentedEntryId === expenseId
      )
    ).toBe(false)
  })

  it("paginates by presented date and numeric sequence without gaps", async () => {
    const first = await queries.listJournalChains({ bookId, limit: 2 })
    const second = await queries.listJournalChains({
      bookId,
      limit: 2,
      cursor: first.nextKey ?? undefined,
    })

    expect(first.items).toHaveLength(2)
    expect(second.items).toHaveLength(2)
    expect(
      second.items.map(({ presentedEntryId }) => presentedEntryId)
    ).toEqual([incomeId, openingId])
    expect(
      new Set(
        [...first.items, ...second.items].map(
          ({ presentedEntryId }) => presentedEntryId
        )
      ).size
    ).toBe(4)
  })

  it("returns null continuation on the final page", async () => {
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(result.nextKey).toBeNull()
  })

  it("uses the chain root as the cursor tie-breaker", async () => {
    const first = await queries.listJournalChains({ bookId, limit: 1 })
    const cursor = first.nextKey

    expect(cursor).toEqual(
      expect.objectContaining({
        chainId: transferId,
        occurredOn: "2026-08-04",
        sequence: "4",
      })
    )
  })

  it("omits technical reversal rows and marks a cancelled chain", async () => {
    const reversalId = await scenario.reverse({ journalEntryId: expenseId })
    const result = await queries.listJournalChains({ bookId, limit: 10 })
    const cancelled = result.items.find(({ chainId }) => chainId === expenseId)

    expect(cancelled).toEqual(
      expect.objectContaining({
        chainId: expenseId,
        presentedEntryId: expenseId,
        status: "CANCELLED",
      })
    )
    expect(
      result.items.some(
        ({ presentedEntryId }) => presentedEntryId === reversalId
      )
    ).toBe(false)
  })

  it("follows a replacement and exposes the edited leaf", async () => {
    await insertReplacement(scenario, expenseId, checking, food)
    const result = await queries.listJournalChains({ bookId, limit: 10 })
    const edited = result.items.find(({ chainId }) => chainId === expenseId)

    expect(edited).toEqual(
      expect.objectContaining({
        chainId: expenseId,
        presentedEntryId: "replacement-1",
        status: "EDITED",
        description: "Corrected lunch",
        amountMinor: "800",
      })
    )
  })

  it("does not return a replacement as a second chain row", async () => {
    await insertReplacement(scenario, expenseId, checking, food)
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(
      result.items.filter(({ chainId }) => chainId === expenseId)
    ).toHaveLength(1)
  })

  it("keeps current account and category names after archive", async () => {
    await scenario.archiveAccount(food)
    const result = await queries.listJournalChains({
      bookId,
      categoryIds: [food] as never,
      limit: 10,
    })

    expect(result.items[0]?.categories).toEqual([
      { id: food, name: "Food", kind: "EXPENSE" },
    ])
  })

  it("preserves decimal sequence text beyond JavaScript safe integers", async () => {
    await scenario.database.execute(
      "UPDATE journal_entries SET sequence = ? WHERE id = ?",
      ["9007199254740993", expenseId]
    )
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(
      result.items.find(
        ({ presentedEntryId }) => presentedEntryId === expenseId
      )?.sequence
    ).toBe("9007199254740993")
  })

  it("preserves exact signed posting amounts in the hydrated list-derived accounts", async () => {
    const result = await queries.listJournalChains({ bookId, limit: 10 })
    const expense = result.items.find(
      ({ presentedEntryId }) => presentedEntryId === expenseId
    )

    expect(expense?.amountMinor).toBe("700")
    expect(expense?.financialAccounts[0]?.kind).toBe("ASSET")
  })

  it("executes one page query and one hydration query", async () => {
    const original = scenario.database.queryOnConnection.bind(scenario.database)
    const calls: string[] = []
    const spy = vi
      .spyOn(scenario.database, "queryOnConnection")
      .mockImplementation((sql, parameters) => {
        calls.push(sql)
        return original(sql, parameters)
      })

    await queries.listJournalChains({ bookId, limit: 10 })

    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain("WITH RECURSIVE")
    expect(calls[1]).toContain("FROM postings")
    spy.mockRestore()
  })

  it("keeps the two-statement cardinality on an empty page", async () => {
    const original = scenario.database.queryOnConnection.bind(scenario.database)
    const spy = vi
      .spyOn(scenario.database, "queryOnConnection")
      .mockImplementation((sql, parameters) => original(sql, parameters))

    const result = await queries.listJournalChains({
      bookId,
      search: "does-not-exist",
      limit: 10,
    })

    expect(result.items).toEqual([])
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it("keeps raw LedgerReadQueries behavior available beside the consolidated adapter", async () => {
    const raw = new SqliteLedgerQueries(scenario.database)
    const result = await raw.listJournalEntries({ bookId, limit: 10 })

    expect(result.items.map(({ id }) => id)).toEqual([
      transferId,
      expenseId,
      incomeId,
      openingId,
    ])
  })

  it("does not leak a different book into the result", async () => {
    await scenario.database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
      ["book-2", "Other", "BRL", "UTC", 0]
    )
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(
      result.items.every(({ chainId }) => !chainId.includes("book-2"))
    ).toBe(true)
    expect(result.items).toHaveLength(4)
  })

  it("accepts all supported business type filters", async () => {
    for (const type of [
      "OPENING_BALANCE",
      "INCOME",
      "EXPENSE",
      "TRANSFER",
    ] as const) {
      const result = await queries.listJournalChains({
        bookId,
        types: [type],
        limit: 10,
      })
      expect(result.items.every((item) => item.type === type)).toBe(true)
    }
  })

  it("accepts both supported origin values", async () => {
    for (const origin of ["MANUAL", "SYSTEM"] as const) {
      const result = await queries.listJournalChains({
        bookId,
        origins: [origin],
        limit: 10,
      })
      expect(result.items).toHaveLength(origin === "MANUAL" ? 4 : 0)
      expect(result.items.every((item) => item.origin === origin)).toBe(true)
    }
  })

  it("returns empty when category and account filters have no intersection", async () => {
    const result = await queries.listJournalChains({
      bookId,
      accountIds: [savings] as never,
      categoryIds: [food] as never,
      limit: 10,
    })

    expect(result.items).toEqual([])
  })

  it("orders rows by descending occurred date before numeric sequence", async () => {
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(result.items.map(({ occurredOn }) => occurredOn)).toEqual([
      "2026-08-04",
      "2026-08-03",
      "2026-08-02",
      "2026-08-01",
    ])
  })

  it("returns exact recordedAt values for the presented entries", async () => {
    const result = await queries.listJournalChains({ bookId, limit: 10 })

    expect(
      result.items.every(
        ({ recordedAt }) => recordedAt === "2026-08-04T12:00:00.000Z"
      )
    ).toBe(true)
  })

  it("returns the next key with the normalized filter fingerprint", async () => {
    const result = await queries.listJournalChains({
      bookId,
      search: "a",
      limit: 1,
    })

    expect(result.nextKey?.filterFingerprint).toContain('"search":"a"')
  })

  it("does not hydrate technical rows when the page is empty", async () => {
    const original = scenario.database.queryOnConnection.bind(scenario.database)
    const calls: string[] = []
    const spy = vi
      .spyOn(scenario.database, "queryOnConnection")
      .mockImplementation((sql, parameters) => {
        calls.push(sql)
        return original(sql, parameters)
      })

    await queries.listJournalChains({
      bookId,
      from: { value: "2027-01-01" } as never,
      limit: 10,
    })

    expect(calls[1]).toContain("WHERE 1 = 0")
    spy.mockRestore()
  })

  it("returns an exact expense detail with signed postings", async () => {
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail).toMatchObject({
      chainId: expenseId,
      presentedEntryId: expenseId,
      type: "EXPENSE",
      amountMinor: "700",
      description: "Café lunch",
      postings: [
        {
          account: { id: food, name: "Food", kind: "EXPENSE" },
          amountMinor: "700",
          position: 0,
        },
        {
          account: { id: checking, name: "Checking", kind: "ASSET" },
          amountMinor: "-700",
          position: 1,
        },
      ],
    })
    expect(
      detail?.history.map(({ role, entryId }) => ({ role, entryId }))
    ).toEqual([{ role: "ORIGINAL", entryId: expenseId }])
  })

  it("returns an exact income detail", async () => {
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: incomeId as never,
    })

    expect(detail).toMatchObject({
      type: "INCOME",
      status: "ACTIVE",
      amountMinor: "2500",
      currency: "BRL",
      categories: [{ id: salary, name: "Salary", kind: "INCOME" }],
    })
    expect(detail?.postings.map(({ amountMinor }) => amountMinor)).toEqual([
      "2500",
      "-2500",
    ])
  })

  it("returns an exact opening-balance detail", async () => {
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: openingId as never,
    })

    expect(detail).toMatchObject({
      type: "OPENING_BALANCE",
      status: "ACTIVE",
      amountMinor: "10000",
      financialAccounts: [{ id: checking, name: "Checking", kind: "ASSET" }],
    })
    expect(
      detail?.history[0]?.postings.map(({ amountMinor }) => amountMinor)
    ).toEqual(["10000", "-10000"])
  })

  it("returns a transfer detail with opposite endpoints and no category", async () => {
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: transferId as never,
    })

    expect(detail).toMatchObject({
      type: "TRANSFER",
      amountMinor: "300",
      categories: [],
      transfer: {
        source: { id: checking, name: "Checking", kind: "ASSET" },
        destination: { id: savings, name: "Savings", kind: "ASSET" },
      },
    })
    expect(detail?.postings.map(({ amountMinor }) => amountMinor)).toEqual([
      "-300",
      "300",
    ])
  })

  it("resolves a detail from a reversal member to its root", async () => {
    const reversalId = await scenario.reverse({ journalEntryId: expenseId })
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: reversalId as never,
    })

    expect(detail?.chainId).toBe(expenseId)
    expect(detail?.presentedEntryId).toBe(expenseId)
    expect(detail?.history.map(({ entryId }) => entryId)).toEqual([
      expenseId,
      reversalId,
    ])
  })

  it("includes cancellation history with the reversal role and exact postings", async () => {
    const reversalId = await scenario.reverse({ journalEntryId: expenseId })
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.status).toBe("CANCELLED")
    expect(detail?.history).toEqual([
      expect.objectContaining({ entryId: expenseId, role: "ORIGINAL" }),
      expect.objectContaining({
        entryId: reversalId,
        role: "REVERSAL",
        postings: [
          expect.objectContaining({ amountMinor: "-700", position: 0 }),
          expect.objectContaining({ amountMinor: "700", position: 1 }),
        ],
      }),
    ])
  })

  it("exposes the replacement leaf and ordered amendment history", async () => {
    await insertReplacement(scenario, expenseId, checking, food)
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail).toMatchObject({
      chainId: expenseId,
      presentedEntryId: "replacement-1",
      status: "EDITED",
      description: "Corrected lunch",
      amountMinor: "800",
    })
    expect(
      detail?.history.map(({ entryId, role }) => ({ entryId, role }))
    ).toEqual([
      { entryId: expenseId, role: "ORIGINAL" },
      { entryId: "replacement-1", role: "REPLACEMENT" },
    ])
  })

  it("keeps multiple amendments and their reversal before the next replacement", async () => {
    await insertReplacement(scenario, expenseId, checking, food)
    await insertReplacementValues(scenario, {
      id: "replacement-2",
      originalId: "replacement-1",
      accountId: checking,
      categoryId: food,
      sequence: "7",
      occurredOn: "2026-08-06",
      recordedAt: "2026-08-04T12:00:02.000Z",
      description: "Corrected lunch again",
      amountMinor: "900",
    })
    const reversalId = await scenario.reverse({
      journalEntryId: "replacement-2",
      occurredOn: "2026-08-06",
    })
    await scenario.database.execute(
      "UPDATE journal_entries SET recorded_at = ? WHERE id = ?",
      ["2026-08-04T12:00:03.000Z", reversalId]
    )
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: reversalId as never,
    })

    expect(detail?.presentedEntryId).toBe("replacement-2")
    expect(
      detail?.history.map(({ entryId, role }) => ({ entryId, role }))
    ).toEqual([
      { entryId: expenseId, role: "ORIGINAL" },
      { entryId: "replacement-1", role: "REPLACEMENT" },
      { entryId: "replacement-2", role: "REPLACEMENT" },
      { entryId: reversalId, role: "REVERSAL" },
    ])
  })

  it("uses current account and category names in the detail", async () => {
    await scenario.archiveAccount(food)
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.categories).toEqual([
      { id: food, name: "Food", kind: "EXPENSE" },
    ])
    expect(detail?.postings[0]?.account.name).toBe("Food")
  })

  it("returns null for an unknown member", async () => {
    await expect(
      queries.getJournalChainDetail({
        bookId,
        entryId: "missing-entry" as never,
      })
    ).resolves.toBeNull()
  })

  it("does not resolve a chain from a different book", async () => {
    await scenario.database.execute(
      "INSERT INTO financial_books (id, name, base_currency, timezone, version) VALUES (?, ?, ?, ?, ?)",
      ["book-2", "Other", "BRL", "UTC", 0]
    )
    await expect(
      queries.getJournalChainDetail({
        bookId: "book-2" as never,
        entryId: expenseId as never,
      })
    ).resolves.toBeNull()
  })

  it("keeps only the effective entry postings on the detail root", async () => {
    await insertReplacement(scenario, expenseId, checking, food)
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.postings.map(({ id }) => id)).toEqual([
      "replacement-1-posting-category",
      "replacement-1-posting-account",
    ])
    expect(detail?.history.every(({ postings }) => postings.length === 2)).toBe(
      true
    )
  })

  it("preserves posting positions and currencies exactly", async () => {
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: incomeId as never,
    })

    expect(
      detail?.postings.map(({ id, currency, position }) => ({
        id,
        currency,
        position,
      }))
    ).toEqual([
      { id: expect.any(String), currency: "BRL", position: 0 },
      { id: expect.any(String), currency: "BRL", position: 1 },
    ])
  })

  it("preserves decimal sequence text beyond JavaScript safe integers", async () => {
    await scenario.database.execute(
      "UPDATE journal_entries SET sequence = ? WHERE id = ?",
      ["9007199254740993", expenseId]
    )
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.sequence).toBe("9007199254740993")
    expect(detail?.history[0]?.sequence).toBe("9007199254740993")
  })

  it("preserves exact signed amounts beyond JavaScript safe integers", async () => {
    await scenario.database.execute(
      "UPDATE postings SET amount_minor = ? WHERE journal_entry_id = ? AND position = 0",
      ["9007199254740993", expenseId]
    )
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.postings[0]?.amountMinor).toBe("9007199254740993")
  })

  it("orders history by recordedAt and numeric sequence", async () => {
    await insertReplacement(scenario, expenseId, checking, food)
    await scenario.database.execute(
      "UPDATE journal_entries SET recorded_at = ?, sequence = ? WHERE id = ?",
      ["2026-08-04T12:00:00.000Z", "10", "replacement-1"]
    )
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.history.map(({ entryId }) => entryId)).toEqual([
      expenseId,
      "replacement-1",
    ])
  })

  it("executes one history query and one batched posting query", async () => {
    const original = scenario.database.queryOnConnection.bind(scenario.database)
    const calls: string[] = []
    const spy = vi
      .spyOn(scenario.database, "queryOnConnection")
      .mockImplementation((sql, parameters) => {
        calls.push(sql)
        return original(sql, parameters)
      })

    await queries.getJournalChainDetail({ bookId, entryId: expenseId as never })

    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain("WITH RECURSIVE ancestors")
    expect(calls[1]).toContain("FROM postings")
    spy.mockRestore()
  })

  it("uses one history query and skips hydration for a missing member", async () => {
    const spy = vi.spyOn(scenario.database, "queryOnConnection")

    await expect(
      queries.getJournalChainDetail({
        bookId,
        entryId: "missing-entry" as never,
      })
    ).resolves.toBeNull()

    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it("keeps detail history and postings in one deferred read snapshot", async () => {
    const readTransaction = vi.spyOn(scenario.database, "readTransaction")

    await queries.getJournalChainDetail({ bookId, entryId: expenseId as never })

    expect(readTransaction).toHaveBeenCalledOnce()
    readTransaction.mockRestore()
  })

  it("does not expose technical reversal entries as the presented entry", async () => {
    const reversalId = await scenario.reverse({ journalEntryId: expenseId })
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: reversalId as never,
    })

    expect(detail?.presentedEntryId).toBe(expenseId)
    expect(detail?.history.some(({ entryId }) => entryId === reversalId)).toBe(
      true
    )
  })

  it("keeps history roles and payload values separate", async () => {
    const reversalId = await scenario.reverse({ journalEntryId: expenseId })
    const detail = await queries.getJournalChainDetail({
      bookId,
      entryId: expenseId as never,
    })

    expect(detail?.history[0]).toMatchObject({
      entryId: expenseId,
      role: "ORIGINAL",
      occurredOn: "2026-08-03",
      recordedAt: "2026-08-04T12:00:00.000Z",
      sequence: "3",
      description: "Café lunch",
    })
    expect(detail?.history[1]).toMatchObject({
      entryId: reversalId,
      role: "REVERSAL",
      postings: expect.arrayContaining([
        expect.objectContaining({ currency: "BRL", position: 0 }),
      ]),
    })
  })
})

async function insertReplacement(
  scenario: FinancialQueryScenario,
  originalId: string,
  accountId: string,
  categoryId: string
): Promise<void> {
  await insertReplacementValues(scenario, {
    id: "replacement-1",
    originalId,
    accountId,
    categoryId,
    sequence: "6",
    occurredOn: "2026-08-05",
    recordedAt: "2026-08-04T12:00:01.000Z",
    description: "Corrected lunch",
    amountMinor: "800",
  })
}

async function insertReplacementValues(
  scenario: FinancialQueryScenario,
  values: {
    readonly id: string
    readonly originalId: string
    readonly accountId: string
    readonly categoryId: string
    readonly sequence: string
    readonly occurredOn: string
    readonly recordedAt: string
    readonly description: string
    readonly amountMinor: string
  }
): Promise<void> {
  await scenario.database.execute(
    "INSERT INTO journal_entries " +
      "(id, book_id, occurred_on, recorded_at, sequence, description, currency, origin, " +
      "replacement_of_id, search_text, search_version, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      values.id,
      "book-1",
      values.occurredOn,
      values.recordedAt,
      values.sequence,
      values.description,
      "BRL",
      "MANUAL",
      values.originalId,
      values.description.toLowerCase(),
      1,
      0,
    ]
  )
  await scenario.database.execute(
    "INSERT INTO postings " +
      "(id, book_id, journal_entry_id, account_id, position, amount_minor, currency) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)",
    [
      `${values.id}-posting-category`,
      "book-1",
      values.id,
      values.categoryId,
      0,
      values.amountMinor,
      "BRL",
      `${values.id}-posting-account`,
      "book-1",
      values.id,
      values.accountId,
      1,
      `-${values.amountMinor}`,
      "BRL",
    ]
  )
  await scenario.database.execute(
    "UPDATE journal_entries SET replaced_by_id = ? WHERE id = ?",
    [values.id, values.originalId]
  )
}
