import {
  CreateFinancialAccount,
  SetInvestmentOpeningBalance,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createBook, createHarness } from "./test-helpers.js"
async function setup() {
  const h = createHarness()
  await createBook(h)
  const account = await new CreateFinancialAccount(
    h.transactionManager,
    h.dispatcher,
    h.ids
  ).execute({ bookId: "book-1", name: "Broker", type: "INVESTMENT_ACCOUNT" })
  if (!account.ok) throw new Error()
  h.publisher.clear()
  return h
}
function useCase(h: Awaited<ReturnType<typeof setup>>) {
  return new SetInvestmentOpeningBalance(
    h.transactionManager,
    h.dispatcher,
    h.ids,
    h.clock
  )
}
const command = {
  bookId: "book-1",
  requestId: "request-1",
  accountId: "account-5",
  amountMinor: "1000",
  currency: "BRL",
  occurredOn: "2026-08-04",
  description: "Opening",
} as const
describe("SetInvestmentOpeningBalance", () => {
  it("recognizes known cost plus real cash with the explicit ledger amount", async () => {
    const h = await setup()
    const result = await useCase(h).execute({
      ...command,
      amountMinor: "10500",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        requestId: "request-1",
        journalEntryIds: ["entry-1"],
        warnings: [],
      },
    })
    expect(h.store.listJournalEntries()[0]?.postings).toEqual([
      {
        id: "posting-1",
        accountId: "account-5",
        amountMinor: 10500n,
        currency: "BRL",
      },
      {
        id: "posting-2",
        accountId: "account-1",
        amountMinor: -10500n,
        currency: "BRL",
      },
    ])
  })
  it("retries same command without a second journal", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(await useCase(h).execute(command)).toEqual({
      ok: true,
      value: {
        requestId: "request-1",
        journalEntryIds: ["entry-1"],
        warnings: [],
      },
    })
    expect(h.store.listJournalEntries()).toHaveLength(1)
  })
  it("rejects changed amount under same request", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(
      await useCase(h).execute({ ...command, amountMinor: "2000" })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })
  it("preserves already-set error for a new request", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(
      await useCase(h).execute({ ...command, requestId: "request-2" })
    ).toMatchObject({
      ok: false,
      error: { code: "OPENING_BALANCE_ALREADY_SET" },
    })
    expect(h.store.listJournalEntries()).toEqual([
      expect.objectContaining({
        id: "entry-1",
        postings: expect.arrayContaining([
          expect.objectContaining({ amountMinor: 1000n }),
        ]),
      }),
    ])
  })
  it("records no receipt or journal when the explicit balance fails", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, accountId: "missing" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
    expect(
      h.store.getInvestmentRequest("book-1" as never, "request-1")
    ).toBeUndefined()
    expect(h.store.listJournalEntries()).toEqual([])
  })
  it("returns empty warnings", async () => {
    const h = await setup()
    expect(await useCase(h).execute(command)).toMatchObject({
      ok: true,
      value: { warnings: [] },
    })
  })
  it("keeps request id in result", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, requestId: "abc" })
    ).toMatchObject({ ok: true, value: { requestId: "abc" } })
  })
  it("rejects a non-positive balance without persisting an idempotency receipt", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, amountMinor: "-1" })
    ).toMatchObject({ ok: false, error: { code: "NON_POSITIVE_AMOUNT" } })
    expect(h.store.listJournalEntries()).toEqual([])
    expect(
      h.store.getInvestmentRequest("book-1" as never, "request-1")
    ).toBeUndefined()
  })
  it("rejects missing account", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, accountId: "none" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
  })
  it("rejects missing book", async () => {
    const h = await setup()
    expect(
      await useCase(h).execute({ ...command, bookId: "none" })
    ).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })
  })
  it("stores one receipt", async () => {
    const h = await setup()
    await useCase(h).execute(command)
    expect(
      h.store.getInvestmentRequest("book-1" as never, "request-1")
    ).toMatchObject({ result: { journalEntryIds: ["entry-1"] } })
  })
  it("uses the supplied opening date", async () => {
    const h = await setup()
    await useCase(h).execute({ ...command, occurredOn: "2026-08-03" })
    expect(h.store.listJournalEntries()[0]).toMatchObject({
      occurredOn: "2026-08-03",
    })
  })
  it("does not create an implicit allocation, transfer, or valuation", async () => {
    const h = await setup()

    await useCase(h).execute(command)

    expect(h.store.listInvestmentPositions()).toEqual([])
    expect(h.store.listInvestmentOperations()).toEqual([])
    expect(h.store.listInvestmentValuations()).toEqual([])
    expect(h.store.listJournalEntries()).toHaveLength(1)
  })
  it("keeps a confirmed balance after a later failed request", async () => {
    const h = await setup()
    await useCase(h).execute(command)

    await useCase(h).execute({
      ...command,
      requestId: "failed-follow-up",
      accountId: "missing",
    })

    expect(h.store.listJournalEntries()).toEqual([
      expect.objectContaining({
        id: "entry-1",
        postings: expect.arrayContaining([
          expect.objectContaining({
            accountId: "account-5",
            amountMinor: 1000n,
          }),
        ]),
      }),
    ])
    expect(
      h.store.getInvestmentRequest("book-1" as never, "failed-follow-up")
    ).toBeUndefined()
  })
  it("rejects a currency mismatch without persisting a balance or receipt", async () => {
    const h = await setup()

    expect(
      await useCase(h).execute({
        ...command,
        requestId: "request-usd",
        currency: "USD",
      })
    ).toMatchObject({ ok: false, error: { code: "CURRENCY_MISMATCH" } })
    expect(h.store.listJournalEntries()).toEqual([])
    expect(
      h.store.getInvestmentRequest("book-1" as never, "request-usd")
    ).toBeUndefined()
  })
})
