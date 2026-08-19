import { describe, expect, it } from "vitest"
import { normalizeSearchText } from "./search-text.js"

describe("normalizeSearchText", () => {
  it.each([
    ["", ""],
    ["   ", ""],
    [" Café ", "café"],
    ["CAFÉ", "café"],
    ["Cafe", "cafe"],
    ["cafe", "cafe"],
    ["café", "café"],
    ["cafe\u0301", "café"],
    ["  São Paulo  ", "são paulo"],
  ])("normalizes %j to %j", (value, expected) => {
    expect(normalizeSearchText(value)).toBe(expected)
  })

  it("preserves the distinction between unaccented and accented text", () => {
    expect(normalizeSearchText("cafe")).not.toBe(normalizeSearchText("café"))
  })
})
