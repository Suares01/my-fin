import type {
  AccountSummaryView,
  JournalChainDetail,
  JournalChainListItem,
  JournalChainSummary,
  JournalViewQueries,
  LedgerReadQueries,
} from "./index.js"
import { describe, expect, expectTypeOf, it } from "vitest"

const account: AccountSummaryView = {
  id: "account-1",
  name: "Checking",
  kind: "ASSET",
}

const listItem: JournalChainListItem = {
  chainId: "entry-root",
  presentedEntryId: "entry-current",
  presentedVersion: 2,
  type: "TRANSFER",
  status: "EDITED",
  occurredOn: "2026-08-04",
  recordedAt: "2026-08-04T12:00:00.000Z",
  sequence: "10",
  description: "Move funds",
  origin: "MANUAL",
  amountMinor: "1000",
  currency: "BRL",
  financialAccounts: [account],
  categories: [],
  transfer: { source: account, destination: { ...account, id: "account-2" } },
}

const summary: JournalChainSummary = {
  incomeMinor: "1200",
  expenseMinor: "300",
  largestTransactionMinor: "900",
  transactionCount: 4,
  currency: "BRL",
}

describe("journal view query contracts", () => {
  it("models the consolidated list with stable chain and presented-entry identity", () => {
    expect(listItem.chainId).toBe("entry-root")
    expect(listItem.presentedEntryId).toBe("entry-current")
    expect(listItem.presentedVersion).toBe(2)
    expect(listItem.status).toBe("EDITED")
    expect(listItem.transfer?.source.id).toBe("account-1")
    expect(listItem.transfer?.destination.id).toBe("account-2")
  })

  it("models exact postings and ordered history roles on chain detail", () => {
    const detail: JournalChainDetail = {
      ...listItem,
      postings: [
        {
          id: "posting-1",
          account,
          amountMinor: "-1000",
          currency: "BRL",
          position: 0,
        },
      ],
      history: [
        {
          entryId: "entry-root",
          role: "ORIGINAL",
          occurredOn: "2026-08-04",
          recordedAt: "2026-08-04T12:00:00.000Z",
          sequence: "10",
          description: "Move funds",
          postings: [],
        },
        {
          entryId: "entry-reversal",
          role: "REVERSAL",
          occurredOn: "2026-08-04",
          recordedAt: "2026-08-04T12:00:01.000Z",
          sequence: "11",
          description: "Reverse move",
          postings: [],
        },
        {
          entryId: "entry-current",
          role: "REPLACEMENT",
          occurredOn: "2026-08-04",
          recordedAt: "2026-08-04T12:00:02.000Z",
          sequence: "12",
          description: "Move funds corrected",
          postings: [],
        },
      ],
    }

    expect(detail.postings[0]?.amountMinor).toBe("-1000")
    expect(detail.history.map((item) => item.role)).toEqual([
      "ORIGINAL",
      "REVERSAL",
      "REPLACEMENT",
    ])
  })

  it("keeps the raw ledger port and exposes typed consolidated query methods", () => {
    const rawQueries: LedgerReadQueries = {
      listAccountBalances: async () => [],
      listAccountStatement: async () => ({ items: [], nextKey: null }),
      listJournalEntries: async () => ({ items: [], nextKey: null }),
    }
    const queries: JournalViewQueries = {
      listJournalChains: async () => ({ items: [], nextKey: null }),
      getJournalChainDetail: async () => null,
      getJournalChainSummary: async () => summary,
    }

    expect(rawQueries.listJournalEntries).toBeTypeOf("function")
    expect(queries.getJournalChainDetail).toBeTypeOf("function")
    expectTypeOf<
      Parameters<JournalViewQueries["listJournalChains"]>[0]
    >().toMatchTypeOf<{
      bookId: string
      limit: number
      cursor?: {
        occurredOn: string
        sequence: string
        chainId: string
        filterFingerprint: string
      }
    }>()
    expectTypeOf<
      ReturnType<JournalViewQueries["getJournalChainDetail"]>
    >().toEqualTypeOf<Promise<JournalChainDetail | null>>()
    expectTypeOf<
      ReturnType<JournalViewQueries["getJournalChainSummary"]>
    >().toEqualTypeOf<Promise<JournalChainSummary>>()
    expect(queries.getJournalChainSummary).toBeTypeOf("function")
  })
})
