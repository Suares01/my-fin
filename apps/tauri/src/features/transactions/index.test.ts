import * as transactions from "./index.js"
import { describe, expect, it } from "vitest"

describe("transactions feature entry point", () => {
  it("exports the transactions page through the public entry point", () => {
    expect(transactions.TransactionsPage).toBeTypeOf("function")
  })

  it("does not expose internal transaction primitives", () => {
    expect(Object.keys(transactions)).toEqual(["TransactionsPage"])
  })
})
