import { describe, expect, it } from "vitest"
import { DomainError } from "./kernel/domain-error.js"
import { LocalDate } from "./local-date.js"

function expectInvalidDate(value: string): void {
  try {
    LocalDate.parse(value)
    throw new Error("expected date to be rejected")
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("INVALID_DATE")
  }
}

describe("LocalDate", () => {
  it("preserves a valid date value", () => {
    const date = LocalDate.parse("2026-08-04")

    expect(date.value).toBe("2026-08-04")
    expect(date.toString()).toBe("2026-08-04")
  })

  it("orders dates lexicographically by calendar day", () => {
    const earlier = LocalDate.parse("2026-08-03")
    const later = LocalDate.parse("2026-08-04")

    expect(earlier.compareTo(later)).toBe(-1)
    expect(later.compareTo(earlier)).toBe(1)
    expect(later.compareTo(LocalDate.parse("2026-08-04"))).toBe(0)
  })

  it("compares equal dates by their preserved value", () => {
    expect(
      LocalDate.parse("2024-02-29").equals(LocalDate.parse("2024-02-29"))
    ).toBe(true)
    expect(
      LocalDate.parse("2024-02-29").equals(LocalDate.parse("2024-03-01"))
    ).toBe(false)
  })

  it.each(["2026-8-04", "26-08-04", "2026/08/04", " 2026-08-04"])(
    "rejects invalid format %j",
    (value) => expectInvalidDate(value)
  )

  it.each(["2026-00-10", "2026-13-01", "2026-04-31"])(
    "rejects impossible month or day %j",
    (value) => expectInvalidDate(value)
  )

  it("rejects February 29 in a non-leap year", () => {
    expectInvalidDate("2023-02-29")
  })

  it("accepts February 29 in a leap year", () => {
    expect(LocalDate.parse("2024-02-29").value).toBe("2024-02-29")
  })

  it("applies the century rule for leap years", () => {
    expect(LocalDate.parse("2000-02-29").value).toBe("2000-02-29")
    expectInvalidDate("1900-02-29")
  })

  it("rejects year zero as a non-civil date", () => {
    expectInvalidDate("0000-01-01")
  })
})
