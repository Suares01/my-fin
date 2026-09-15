import { describe, expect, it } from "vitest"
import {
  decodeInvestmentOperationCursor,
  encodeInvestmentOperationCursor,
} from "./investment-operation-cursor.js"
describe("investment operation cursor", () => {
  it("round trips io1", () =>
    expect(
      decodeInvestmentOperationCursor(
        encodeInvestmentOperationCursor({
          fingerprint: "b|p",
          occurredOn: "2026-01-01",
          sequence: "2",
          id: "o",
        })
      )
    ).toMatchObject({ id: "o" }))
  it("rejects non io1", () =>
    expect(() => decodeInvestmentOperationCursor("iv1.x")).toThrow())
})
