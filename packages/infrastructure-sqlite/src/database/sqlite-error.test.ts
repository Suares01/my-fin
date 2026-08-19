import { ApplicationError } from "@workspace/application"
import { DomainError } from "@workspace/domain"
import { describe, expect, it } from "vitest"
import {
  assertSqliteIntegerRange,
  assertSqliteSequence,
  mapSqliteError,
  parseSqliteError,
} from "./sqlite-error.js"

describe("SQLite error boundary", () => {
  it("preserves driver code, extended code, message and cause", () => {
    const cause = Object.assign(new Error("INSERT INTO books VALUES (?)"), {
      code: "SQLITE_CONSTRAINT_CHECK",
      errno: 275,
    })

    expect(parseSqliteError(cause)).toEqual({
      code: "SQLITE_CONSTRAINT_CHECK",
      extendedCode: 275,
      message: "INSERT INTO books VALUES (?)",
      cause,
    })
  })

  it("maps a unique constraint code to DUPLICATE_ENTITY", () => {
    const mapped = mapSqliteError({
      code: "SQLITE_CONSTRAINT_UNIQUE",
      message: "UNIQUE constraint failed: ledger_accounts.name",
    })

    expect(mapped).toMatchObject({
      code: "DUPLICATE_ENTITY",
      message: "The requested entity already exists",
    })
  })

  it("maps a primary-key extended code to DUPLICATE_ENTITY", () => {
    const mapped = mapSqliteError({
      code: "SQLITE_CONSTRAINT",
      errno: 1555,
      message: "SQL and /tmp/secret.db",
    })

    expect(mapped).toMatchObject({ code: "DUPLICATE_ENTITY" })
  })

  it("maps check, foreign-key and overflow failures to UNEXPECTED_ERROR", () => {
    for (const error of [
      { code: "SQLITE_CONSTRAINT_CHECK", errno: 275 },
      { code: "SQLITE_CONSTRAINT_FOREIGNKEY", errno: 787 },
      { code: "SQLITE_TOOBIG", errno: 18 },
    ]) {
      expect(mapSqliteError(error)).toMatchObject({
        code: "UNEXPECTED_ERROR",
        message: "SQLite operation failed",
      })
    }
  })

  it("preserves an existing ApplicationError", () => {
    const error = new ApplicationError("ENTITY_NOT_FOUND", "Book not found")

    expect(mapSqliteError(error)).toBe(error)
  })

  it("preserves an existing DomainError", () => {
    const error = new DomainError("INVALID_DATE", "Date is invalid")

    expect(mapSqliteError(error)).toBe(error)
  })

  it("sanitizes public messages and rejects amounts outside signed 64-bit", () => {
    const error = mapSqliteError({
      code: "SQLITE_CONSTRAINT_CHECK",
      message: "UPDATE books SET name = 'secret' WHERE path = '/tmp/db'",
    })

    expect(error).toMatchObject({
      code: "UNEXPECTED_ERROR",
      message: "SQLite operation failed",
    })
    expect(() =>
      assertSqliteIntegerRange(9223372036854775808n, "amountMinor")
    ).toThrowError(
      new ApplicationError(
        "UNEXPECTED_ERROR",
        "amountMinor is outside the supported SQLite range"
      )
    )
  })

  it("rejects an overflowing next sequence and accepts the signed range", () => {
    expect(() => assertSqliteSequence(9223372036854775808n)).toThrowError(
      new ApplicationError(
        "UNEXPECTED_ERROR",
        "Journal sequence is outside the supported SQLite range"
      )
    )
    expect(() => assertSqliteSequence(1n)).not.toThrow()
    expect(() => assertSqliteIntegerRange(-9223372036854775808n)).not.toThrow()
    expect(() => assertSqliteIntegerRange(9223372036854775807n)).not.toThrow()
  })
})
