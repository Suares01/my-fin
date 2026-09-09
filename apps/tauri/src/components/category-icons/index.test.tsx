import { describe, expect, it } from "vitest"

import {
  categoryIconNames,
  getCategoryIcon,
  getCategoryIconEntries,
  getCategoryIconOrFallback,
} from "./index.js"

describe("category icon registry", () => {
  it("resolves the first registered icon component", () => {
    const firstName = categoryIconNames[0]

    expect(firstName).toBe("aeroplane")
    expect(getCategoryIcon(firstName)).toBe(getCategoryIconEntries()[0]?.Icon)
  })

  it("resolves the middle registered icon component", () => {
    const middleIndex = Math.floor(categoryIconNames.length / 2)
    const middleName = categoryIconNames[middleIndex]

    expect(middleName).toBe("dumbbell")
    expect(getCategoryIcon(middleName)).toBe(
      getCategoryIconEntries()[middleIndex]?.Icon
    )
  })

  it("resolves the last registered icon component", () => {
    const lastIndex = categoryIconNames.length - 1
    const lastName = categoryIconNames[lastIndex]

    expect(lastName).toBe("wheelbarrow-empty")
    expect(getCategoryIcon(lastName)).toBe(
      getCategoryIconEntries()[lastIndex]?.Icon
    )
  })

  it("keeps names unique and entries in deterministic registry order", () => {
    const entries = getCategoryIconEntries()

    expect(new Set(categoryIconNames).size).toBe(categoryIconNames.length)
    expect(entries.map((entry) => entry.name)).toEqual([...categoryIconNames])
  })

  it("falls back to label-dollar for unknown icon keys", () => {
    expect(getCategoryIcon("unknown-icon")).toBeUndefined()
    expect(getCategoryIconOrFallback("unknown-icon")).toBe(
      getCategoryIcon("label-dollar")
    )
  })

  it("does not let callers mutate registry collections or component values", () => {
    const names = [...categoryIconNames]
    const entries = getCategoryIconEntries()

    names.reverse()
    entries.reverse()

    expect(categoryIconNames[0]).toBe("aeroplane")
    expect(getCategoryIconEntries()[0]?.name).toBe("aeroplane")
    expect(
      getCategoryIconEntries().every(
        (entry) => typeof entry.Icon === "function"
      )
    ).toBe(true)
  })
})
