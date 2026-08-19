import { describe, expect, it } from "vitest"

import {
  IPC_CODEC_ERRORS,
  IpcCodecError,
  TauriDatabaseError,
  decodeIpcError,
  decodeIpcExecutionResult,
  decodeIpcRow,
  decodeIpcRows,
  decodeIpcValue,
  encodeSqliteParameters,
  encodeSqliteValue,
  sanitizeIpcError,
} from "./protocol.js"
import * as publicApi from "../index.js"

describe("SQLite IPC protocol", () => {
  it("exposes the codec only through the package public API", () => {
    expect(publicApi.encodeSqliteValue).toBe(encodeSqliteValue)
    expect(publicApi.decodeIpcRow).toBe(decodeIpcRow)
    expect(publicApi.TauriDatabaseError).toBe(TauriDatabaseError)
  })

  it("exports the stable codec error codes", () => {
    expect(IPC_CODEC_ERRORS).toEqual({
      INVALID_VALUE: "INVALID_IPC_VALUE",
      INVALID_PARAMETERS: "INVALID_IPC_PARAMETERS",
      INVALID_ROW: "INVALID_IPC_ROW",
      INVALID_RESULT: "INVALID_IPC_RESULT",
      INVALID_ERROR: "INVALID_IPC_ERROR",
      DATABASE_FAILURE: "DATABASE_OPERATION_FAILED",
    })
  })

  it.each([
    [null, { type: "null" }],
    ["My Fin", { type: "text", value: "My Fin" }],
    [42, { type: "integer", value: "42" }],
    [12.5, { type: "real", value: 12.5 }],
    [new Uint8Array([0, 127, 255]), { type: "blob", value: [0, 127, 255] }],
  ])("encodes %j with its tagged representation", (value, expected) => {
    expect(encodeSqliteValue(value)).toEqual(expected)
  })

  it("encodes positional parameters without changing their order", () => {
    expect(encodeSqliteParameters(["book", 7, null])).toEqual({
      kind: "positional",
      values: [
        { type: "text", value: "book" },
        { type: "integer", value: "7" },
        { type: "null" },
      ],
    })
  })

  it("encodes named parameters with their exact keys", () => {
    expect(encodeSqliteParameters({ bookId: "book-1", amount: 12.5 })).toEqual({
      kind: "named",
      values: {
        bookId: { type: "text", value: "book-1" },
        amount: { type: "real", value: 12.5 },
      },
    })
  })

  it("encodes omitted parameters as an empty positional set", () => {
    expect(encodeSqliteParameters()).toEqual({ kind: "positional", values: [] })
  })

  it("rejects malformed parameters with a stable parameter code", () => {
    expect(() => encodeSqliteParameters(123 as never)).toThrow(
      new IpcCodecError(
        IPC_CODEC_ERRORS.INVALID_PARAMETERS,
        "SQLite parameters must be positional or named"
      )
    )
  })

  it("decodes all tags and keeps int64 as canonical decimal strings", () => {
    expect(
      decodeIpcRow({
        nothing: { type: "null" },
        name: { type: "text", value: "book" },
        amount: { type: "real", value: 10.25 },
        sequence: { type: "integer", value: "9223372036854775807" },
        payload: { type: "blob", value: [1, 2, 255] },
      })
    ).toEqual({
      nothing: null,
      name: "book",
      amount: 10.25,
      sequence: "9223372036854775807",
      payload: new Uint8Array([1, 2, 255]),
    })
  })

  it("decodes a row collection only when every row is tagged", () => {
    expect(
      decodeIpcRows([
        { id: { type: "integer", value: "1" } },
        { id: { type: "integer", value: "2" } },
      ])
    ).toEqual([{ id: "1" }, { id: "2" }])
  })

  it("decodes execution results with an int64 last insert ID", () => {
    expect(
      decodeIpcExecutionResult({
        rowsAffected: 1,
        lastInsertRowId: "9223372036854775807",
      })
    ).toEqual({ rowsAffected: 1, lastInsertRowId: "9223372036854775807" })
  })

  it.each([NaN, Infinity, -Infinity])(
    "rejects non-finite numeric value %j",
    (value) => {
      expect(() => encodeSqliteValue(value)).toThrowError(
        new IpcCodecError(
          IPC_CODEC_ERRORS.INVALID_VALUE,
          "SQLite numeric value must be finite"
        )
      )
    }
  )

  it("rejects an unsafe integer before JSON serialization", () => {
    expect(() => encodeSqliteValue(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      "SQLite integer value must be safe"
    )
  })

  it("rejects an invalid blob byte", () => {
    expect(() => decodeIpcValue({ type: "blob", value: [256] })).toThrow(
      "Invalid SQLite blob"
    )
  })

  it("rejects an unknown value tag with a stable code", () => {
    try {
      decodeIpcValue({ type: "decimal", value: "1" })
      expect.fail("expected an invalid value error")
    } catch (error) {
      expect(error).toMatchObject({ code: IPC_CODEC_ERRORS.INVALID_VALUE })
    }
  })

  it("rejects a malformed row and preserves the row-specific code", () => {
    expect(() =>
      decodeIpcRow({ id: { type: "integer", value: "not-int64" } })
    ).toThrow(
      new IpcCodecError(IPC_CODEC_ERRORS.INVALID_ROW, "Invalid SQLite integer")
    )
  })

  it("rejects a non-array row collection", () => {
    expect(() => decodeIpcRows({ id: { type: "null" } })).toThrow(
      "SQLite rows must be an array"
    )
  })

  it("rejects an invalid execution result", () => {
    expect(() => decodeIpcExecutionResult({ rowsAffected: 1.5 })).toThrow(
      "Invalid SQLite execution result"
    )
  })

  it("rejects an out-of-range last insert ID", () => {
    expect(() =>
      decodeIpcExecutionResult({
        rowsAffected: 1,
        lastInsertRowId: "9223372036854775808",
      })
    ).toThrow("Invalid SQLite last insert row ID")
  })

  it("sanitizes structured driver failures without exposing details", () => {
    expect(
      sanitizeIpcError({
        code: "SQLITE_CONSTRAINT",
        diagnosticId: "diag-123",
        message: "INSERT secret with amount 100",
        sql: "INSERT ...",
      })
    ).toEqual({
      code: "SQLITE_CONSTRAINT",
      diagnosticId: "diag-123",
      message: "Database operation failed",
    })
  })

  it("sanitizes unknown failures to a stable safe response", () => {
    expect(sanitizeIpcError(new Error("/absolute/path with SQL"))).toEqual({
      code: IPC_CODEC_ERRORS.DATABASE_FAILURE,
      diagnosticId: "ipc-unknown",
      message: "Database operation failed",
    })
  })

  it("maps a safe error response to the public database error", () => {
    const error = decodeIpcError({
      code: "SQLITE_BUSY",
      diagnosticId: "diag-busy",
      message: "ignored",
    })

    expect(error).toBeInstanceOf(TauriDatabaseError)
    expect(error).toMatchObject({
      code: "SQLITE_BUSY",
      diagnosticId: "diag-busy",
      message: "Database operation failed",
    })
  })

  it("does not expose codec or driver details in public unknown errors", () => {
    const error = decodeIpcError({
      sql: "SELECT secret",
      parameters: ["money"],
    })

    expect(error).toMatchObject({
      code: IPC_CODEC_ERRORS.DATABASE_FAILURE,
      diagnosticId: "ipc-unknown",
      message: "Database operation failed",
    })
    expect(error.message).not.toContain("secret")
    expect(error.message).not.toContain("money")
  })
})
