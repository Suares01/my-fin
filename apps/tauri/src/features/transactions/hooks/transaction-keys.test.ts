import { describe, expect, it } from "vitest"
import { transactionKeys } from "./transaction-keys.js"

describe("transaction query keys", () => {
  it("scopes the transaction namespace to its owning book", () => {
    expect(transactionKeys.all("book-1")).toEqual([
      "books",
      "book-1",
      "transactions",
    ])
  })

  it("keeps list keys stable for the same normalized server filters", () => {
    const filters = { search: "café", types: ["EXPENSE", "INCOME"] as const }
    expect(transactionKeys.list("book-1", filters)).toEqual(
      transactionKeys.list("book-1", filters)
    )
  })

  it("keeps distinct normalized server filters in separate list keys", () => {
    expect(
      transactionKeys.list("book-1", { types: ["INCOME"] })
    ).not.toEqual(transactionKeys.list("book-1", { types: ["EXPENSE"] }))
  })

  it("keeps chain detail keys stable by chain identity", () => {
    expect(transactionKeys.detail("book-1", "chain-1")).toEqual([
      "books",
      "book-1",
      "transactions",
      "detail",
      "chain-1",
    ])
  })

  it("isolates identical transaction filters and chain identities across books", () => {
    expect(
      transactionKeys.list("book-1", { types: ["TRANSFER"] })
    ).not.toEqual(transactionKeys.list("book-2", { types: ["TRANSFER"] }))
    expect(transactionKeys.detail("book-1", "chain-1")).not.toEqual(
      transactionKeys.detail("book-2", "chain-1")
    )
  })
})
