import { describe, expect, it } from "vitest"
import {
  compareDecimalStrings,
  readAccountKind,
  readAccountStatus,
  readBigInt,
  readBoolean,
  readInteger,
  readJournalOrigin,
  readString,
  toDisplayMinor,
} from "./sqlite-query-values.js"

describe("SQLite query value helpers", () => {
  it("reads strings without coercion", () => {
    expect(readString("BRL", "currency")).toBe("BRL")
    expect(() => readString(7, "currency")).toThrow("currency")
  })

  it("reads exact bigint values from strings, bigint and safe integers", () => {
    expect(readBigInt("9007199254740993", "amount")).toBe(9007199254740993n)
    expect(readBigInt(9007199254740991n, "amount")).toBe(9007199254740991n)
    expect(readBigInt(7, "amount")).toBe(7n)
  })

  it("rejects malformed or unsafe bigint inputs", () => {
    expect(() => readBigInt("1.5", "amount")).toThrow("amount")
    expect(() => readBigInt(Number.MAX_SAFE_INTEGER + 1, "amount")).toThrow(
      "amount"
    )
  })

  it("reads safe integer values and rejects values outside the safe range", () => {
    expect(readInteger("7", "position")).toBe(7)
    expect(readInteger(8n, "position")).toBe(8)
    expect(() => readInteger("9007199254740992", "position")).toThrow(
      "position"
    )
  })

  it("reads SQLite boolean representations without accepting arbitrary truthiness", () => {
    expect(readBoolean(true, "archived")).toBe(true)
    expect(readBoolean(0, "archived")).toBe(false)
    expect(readBoolean(1, "archived")).toBe(true)
    expect(() => readBoolean("true", "archived")).toThrow("archived")
  })

  it("reads all supported account kinds and rejects unknown kinds", () => {
    expect(
      ["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"].map((kind) =>
        readAccountKind(kind)
      )
    ).toEqual(["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"])
    expect(() => readAccountKind("OTHER")).toThrow("accountKind")
  })

  it("reads account statuses and journal origins with exact enums", () => {
    expect(readAccountStatus("ACTIVE")).toBe("ACTIVE")
    expect(readAccountStatus("ARCHIVED")).toBe("ARCHIVED")
    expect(readJournalOrigin("MANUAL")).toBe("MANUAL")
    expect(readJournalOrigin("SYSTEM")).toBe("SYSTEM")
    expect(() => readAccountStatus("DELETED")).toThrow("accountStatus")
    expect(() => readJournalOrigin("IMPORT")).toThrow("journalOrigin")
  })

  it.each([
    ["ASSET", 100n, "100"],
    ["LIABILITY", 100n, "-100"],
    ["INCOME", -100n, "100"],
    ["EXPENSE", -100n, "-100"],
    ["EQUITY", 100n, "-100"],
  ] as const)(
    "converts %s raw balance to its display sign",
    (kind, raw, expected) => {
      expect(toDisplayMinor(raw, kind)).toBe(expected)
    }
  )

  it("orders decimal sequences numerically across 9 and 10", () => {
    expect(compareDecimalStrings("9", "10")).toBe(-1)
    expect(compareDecimalStrings("10", "9")).toBe(1)
    expect(compareDecimalStrings("9007199254740993", "9007199254740993")).toBe(
      0
    )
  })

  it("normalizes equal leading-zero decimals and rejects malformed sequences", () => {
    expect(compareDecimalStrings("01", "1")).toBe(0)
    expect(() => compareDecimalStrings("1.0", "2")).toThrow("left")
  })
})
