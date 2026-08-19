import { describe, expect, it } from "vitest"
import { ApplicationError } from "../ports/errors.js"
import {
  parseAccountKinds,
  parseDateRange,
  parseEnumList,
  parseIdList,
  parseJournalOrigins,
  parseLimit,
  parseMonth,
  parseMonthRange,
  parseOptionalDate,
  parseRequiredId,
  parseSearch,
} from "./query-validation.js"
import {
  decodeJournalEntryCursor,
  decodeStatementCursor,
  encodeJournalEntryCursor,
  encodeStatementCursor,
} from "./cursor-codec.js"

function expectInvalid(action: () => unknown): void {
  try {
    action()
    throw new Error("expected an ApplicationError")
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApplicationError)
    expect((error as ApplicationError).code).toBe("INVALID_QUERY")
  }
}

describe("financial query input validation", () => {
  it("accepts a non-empty required ID without changing its value", () => {
    expect(parseRequiredId("book-1", "bookId")).toBe("book-1")
  })

  it("rejects an empty required ID", () => {
    expectInvalid(() => parseRequiredId("  ", "bookId"))
  })

  it("accepts a real leap-day date", () => {
    expect(parseOptionalDate("2024-02-29", "from")?.value).toBe("2024-02-29")
  })

  it("rejects an impossible calendar date", () => {
    expectInvalid(() => parseOptionalDate("2024-02-30", "from"))
  })

  it("preserves an omitted optional date", () => {
    expect(parseOptionalDate(undefined, "to")).toBeUndefined()
  })

  it("accepts a valid month", () => {
    expect(parseMonth("2026-08", "fromMonth")).toBe("2026-08")
  })

  it("rejects invalid month shapes and month numbers", () => {
    expectInvalid(() => parseMonth("2026-8", "fromMonth"))
    expectInvalid(() => parseMonth("2026-13", "fromMonth"))
  })

  it("rejects year zero", () => {
    expectInvalid(() => parseMonth("0000-01", "fromMonth"))
  })

  it("accepts an inclusive date range in chronological order", () => {
    expect(parseDateRange("2026-01-01", "2026-01-31").to).toMatchObject({
      value: "2026-01-31",
    })
  })

  it("rejects an inverted date range", () => {
    expectInvalid(() => parseDateRange("2026-02-01", "2026-01-31"))
  })

  it("accepts an inclusive month range", () => {
    expect(parseMonthRange("2026-01", "2026-12")).toEqual({
      fromMonth: "2026-01",
      toMonth: "2026-12",
    })
  })

  it("rejects an inverted month range", () => {
    expectInvalid(() => parseMonthRange("2026-12", "2026-01"))
  })

  it("accepts the inclusive page limit bounds", () => {
    expect(parseLimit(1)).toBe(1)
    expect(parseLimit(100)).toBe(100)
  })

  it("rejects a zero page limit", () => {
    expectInvalid(() => parseLimit(0))
  })

  it("rejects a page limit above one hundred", () => {
    expectInvalid(() => parseLimit(101))
  })

  it("rejects a fractional page limit", () => {
    expectInvalid(() => parseLimit(1.5))
  })

  it("accepts valid account kinds and an explicit empty kind filter", () => {
    expect(parseAccountKinds(["ASSET", "EXPENSE"])).toEqual([
      "ASSET",
      "EXPENSE",
    ])
    expect(parseAccountKinds([])).toEqual([])
  })

  it("rejects an invalid account kind", () => {
    expectInvalid(() => parseAccountKinds(["OTHER"]))
  })

  it("rejects an empty required ID list", () => {
    expectInvalid(() => parseIdList([], "accountIds"))
  })

  it("rejects an invalid enum list and accepts valid origins", () => {
    expectInvalid(() => parseJournalOrigins([]))
    expect(parseJournalOrigins(["MANUAL", "SYSTEM"])).toEqual([
      "MANUAL",
      "SYSTEM",
    ])
    expectInvalid(() =>
      parseEnumList(["INVALID"], ["MANUAL", "SYSTEM"] as const, "origins")
    )
  })

  it("trims a non-empty search term", () => {
    expect(parseSearch("  groceries ")).toBe("groceries")
  })

  it("rejects search that becomes empty after trim", () => {
    expectInvalid(() => parseSearch("   "))
  })
})

describe("financial query cursor codecs", () => {
  it("round-trips a statement cursor with a posting position", () => {
    const key = {
      occurredOn: "2026-08-04",
      sequence: "9223372036854775807",
      postingPosition: 3,
    }
    expect(decodeStatementCursor(encodeStatementCursor(key))).toEqual(key)
  })

  it("round-trips a journal cursor with an arbitrary decimal sequence", () => {
    const key = { occurredOn: "2026-08-04", sequence: "9007199254740993" }
    expect(decodeJournalEntryCursor(encodeJournalEntryCursor(key))).toEqual(key)
  })

  it("rejects a cursor with the wrong version prefix", () => {
    expectInvalid(() => decodeStatementCursor("s2.2026-08-04.1.0"))
  })

  it("rejects a cursor with the wrong number of fields", () => {
    expectInvalid(() => decodeJournalEntryCursor("j1.2026-08-04.1.extra"))
  })

  it("rejects a cursor with an invalid decimal sequence", () => {
    expectInvalid(() => decodeStatementCursor("s1.2026-08-04.01.0"))
  })

  it("rejects a cursor with an unsafe posting position", () => {
    expectInvalid(() =>
      decodeStatementCursor("s1.2026-08-04.1.9007199254740992")
    )
  })
})
