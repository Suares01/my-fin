import { describe, expect, it } from "vitest"
import {
  FinancialBookMapper,
  type FinancialBookRow,
} from "./financial-book-mapper.js"

const row: FinancialBookRow = {
  id: "book-1",
  name: "Main",
  base_currency: "BRL",
  timezone: "America/Sao_Paulo",
  version: 3,
}

describe("FinancialBookMapper", () => {
  it("round-trips all persisted book fields exactly", () => {
    const book = FinancialBookMapper.toDomain(row)

    expect(FinancialBookMapper.toPersistence(book)).toEqual({
      id: "book-1",
      name: "Main",
      base_currency: "BRL",
      timezone: "America/Sao_Paulo",
      version: 3,
    })
    expect(book.toSnapshot()).toEqual({
      id: "book-1",
      name: "Main",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      version: 3,
    })
  })

  it("restores a new aggregate without collecting domain facts", () => {
    const book = FinancialBookMapper.toDomain(row)

    expect(book.pullDomainFacts()).toEqual([])
  })

  it("accepts integer versions encoded as strings by the Tauri IPC adapter", () => {
    const book = FinancialBookMapper.toDomain({ ...row, version: "3" })

    expect(book.version).toBe(3)
  })

  it("rejects invalid row shapes before constructing an aggregate", () => {
    expect(() =>
      FinancialBookMapper.toDomain({ ...row, base_currency: "brl" })
    ).toThrow("Invalid financial_books.base_currency")
    expect(() =>
      FinancialBookMapper.toDomain({
        ...row,
        version: Number.MAX_SAFE_INTEGER + 1,
      })
    ).toThrow("Invalid financial_books.version")
  })

  it("rejects missing or blank persisted identity fields", () => {
    expect(() => FinancialBookMapper.toDomain({ ...row, id: " " })).toThrow(
      "Invalid financial_books.id"
    )
    expect(() =>
      FinancialBookMapper.toDomain({ ...row, timezone: null })
    ).toThrow("Invalid financial_books.timezone")
  })
})
