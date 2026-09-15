import { describe, expect, it } from "vitest"
import {
  decodeInvestmentPositionCursor,
  encodeInvestmentPositionCursor,
} from "./investment-position-cursor.js"
describe("investment position cursor", () => {
  it("round trips an ip1 fingerprint", () =>
    expect(
      decodeInvestmentPositionCursor(
        encodeInvestmentPositionCursor({
          fingerprint: "book|OPEN",
          name: "alpha",
          label: "",
          id: "p1",
        })
      )
    ).toEqual({ fingerprint: "book|OPEN", name: "alpha", label: "", id: "p1" }))
  it("rejects malformed or foreign cursors", () => {
    expect(() => decodeInvestmentPositionCursor("io1.bad")).toThrow()
    expect(() => decodeInvestmentPositionCursor("ip1.{}")).toThrow()
  })
})
