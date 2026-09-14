import {
  canonicalize,
  executeInvestmentRequest,
  getInvestmentRequestResult,
} from "@workspace/application"
import { describe, expect, it } from "vitest"
import { createHarness } from "./test-helpers.js"

const result = (requestId = "request-1") => ({
  requestId,
  journalEntryIds: [],
  warnings: [],
})
async function execute(
  h: ReturnType<typeof createHarness>,
  command = { bookId: "book-1", requestId: "request-1", value: 1 }
) {
  return executeInvestmentRequest({
    command,
    transactionManager: h.transactionManager,
    eventDispatcher: h.dispatcher,
    clock: h.clock,
    work: async () => result(command.requestId),
  })
}
describe("executeInvestmentRequest", () => {
  it("persists and returns a receipt result", async () => {
    const h = createHarness()
    expect(await execute(h)).toEqual({ ok: true, value: result() })
    expect(
      await getInvestmentRequestResult({
        transactionManager: h.transactionManager,
        bookId: "book-1",
        requestId: "request-1",
      })
    ).toMatchObject({
      formatVersion: 1,
      result: result(),
      recordedAt: "2026-08-04T12:00:00.000Z",
    })
  })
  it("returns the previous result for equivalent retry", async () => {
    const h = createHarness()
    await execute(h)
    expect(await execute(h)).toEqual({ ok: true, value: result() })
  })
  it("rejects same request id with different semantic content", async () => {
    const h = createHarness()
    await execute(h)
    expect(
      await execute(h, { bookId: "book-1", requestId: "request-1", value: 2 })
    ).toMatchObject({ ok: false, error: { code: "IDEMPOTENCY_CONFLICT" } })
  })
  it("isolates request IDs by book", async () => {
    const h = createHarness()
    await execute(h)
    expect(
      await execute(h, { bookId: "book-2", requestId: "request-1", value: 1 })
    ).toEqual({ ok: true, value: result() })
  })
  it("returns null for absent receipt", async () => {
    const h = createHarness()
    expect(
      await getInvestmentRequestResult({
        transactionManager: h.transactionManager,
        bookId: "book-1",
        requestId: "none",
      })
    ).toBeNull()
  })
  it("canonicalizes object keys", () =>
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}'))
  it("canonicalizes nested keys", () =>
    expect(canonicalize({ b: { z: 1, a: 2 } })).toBe('{"b":{"a":2,"z":1}}'))
  it("canonicalizes arrays in order", () =>
    expect(canonicalize([2, 1])).toBe("[2,1]"))
  it("canonicalizes null", () => expect(canonicalize(null)).toBe("null"))
  it("canonicalizes strings", () => expect(canonicalize("x")).toBe('"x"'))
  it("canonicalizes booleans", () => expect(canonicalize(true)).toBe("true"))
  it("canonicalizes numbers", () => expect(canonicalize(1)).toBe("1"))
  it("stores different request IDs independently", async () => {
    const h = createHarness()
    await execute(h)
    expect(
      await execute(h, { bookId: "book-1", requestId: "request-2", value: 1 })
    ).toEqual({ ok: true, value: result("request-2") })
  })
  it("keeps receipt after a retried request", async () => {
    const h = createHarness()
    await execute(h)
    await execute(h)
    expect(
      await getInvestmentRequestResult({
        transactionManager: h.transactionManager,
        bookId: "book-1",
        requestId: "request-1",
      })
    ).toMatchObject({ result: result() })
  })
  it("preserves request-specific result ID", async () => {
    const h = createHarness()
    expect(
      await execute(h, { bookId: "book-1", requestId: "abc", value: 1 })
    ).toEqual({ ok: true, value: result("abc") })
  })
  it("uses format version one", async () => {
    const h = createHarness()
    await execute(h)
    expect(
      (
        await getInvestmentRequestResult({
          transactionManager: h.transactionManager,
          bookId: "book-1",
          requestId: "request-1",
        })
      )?.formatVersion
    ).toBe(1)
  })
})
