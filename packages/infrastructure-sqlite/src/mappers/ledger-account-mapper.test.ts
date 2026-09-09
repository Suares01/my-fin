import { describe, expect, it } from "vitest"
import {
  LedgerAccountMapper,
  type LedgerAccountRow,
} from "./ledger-account-mapper.js"

const row: LedgerAccountRow = {
  id: "account-1",
  book_id: "book-1",
  name: "Cash",
  normalized_name: "cash",
  kind: "ASSET",
  status: "ARCHIVED",
  system_purpose: "OPENING_BALANCE",
  version: 2,
  icon_key: null,
  color_hex: null,
}

const expenseCategoryRow: LedgerAccountRow = {
  ...row,
  kind: "EXPENSE",
  system_purpose: null,
  icon_key: "label-dollar",
  color_hex: "f43f5e",
}

describe("LedgerAccountMapper", () => {
  it("round-trips all account fields exactly", () => {
    const account = LedgerAccountMapper.toDomain(row)

    expect(LedgerAccountMapper.toPersistence(account)).toEqual({
      id: "account-1",
      book_id: "book-1",
      name: "Cash",
      normalized_name: "cash",
      kind: "ASSET",
      status: "ARCHIVED",
      system_purpose: "OPENING_BALANCE",
      version: 2,
      icon_key: null,
      color_hex: null,
    })
    expect(account.toSnapshot()).toEqual({
      id: "account-1",
      bookId: "book-1",
      name: "Cash",
      normalizedName: "cash",
      kind: "ASSET",
      status: "ARCHIVED",
      systemPurpose: "OPENING_BALANCE",
      version: 2,
    })
  })

  it("round-trips category appearance through both representations", () => {
    const account = LedgerAccountMapper.toDomain(expenseCategoryRow)

    expect(account.toSnapshot()).toMatchObject({
      kind: "EXPENSE",
      iconKey: "label-dollar",
      colorHex: "f43f5e",
    })
    expect(LedgerAccountMapper.toPersistence(account)).toMatchObject({
      kind: "EXPENSE",
      icon_key: "label-dollar",
      color_hex: "f43f5e",
    })
  })

  it("round-trips absent appearance for a financial account as nulls", () => {
    const account = LedgerAccountMapper.toDomain({
      ...row,
      icon_key: null,
      color_hex: null,
    })

    expect(account.toSnapshot()).not.toHaveProperty("iconKey")
    expect(account.toSnapshot()).not.toHaveProperty("colorHex")
    expect(LedgerAccountMapper.toPersistence(account)).toMatchObject({
      icon_key: null,
      color_hex: null,
    })
  })

  it("rejects a managed row with a missing icon", () => {
    expect(() =>
      LedgerAccountMapper.toDomain({ ...expenseCategoryRow, icon_key: null })
    ).toThrow()
  })

  it("rejects a managed row with a missing color", () => {
    expect(() =>
      LedgerAccountMapper.toDomain({ ...expenseCategoryRow, color_hex: null })
    ).toThrow()
  })

  it("rejects malformed managed appearance", () => {
    expect(() =>
      LedgerAccountMapper.toDomain({
        ...expenseCategoryRow,
        icon_key: "Food Icon",
      })
    ).toThrow()
    expect(() =>
      LedgerAccountMapper.toDomain({
        ...expenseCategoryRow,
        color_hex: "#f43f5e",
      })
    ).toThrow()
  })

  it("rejects appearance attached to a non-category row", () => {
    expect(() =>
      LedgerAccountMapper.toDomain({
        ...row,
        icon_key: "cash",
        color_hex: "10b981",
      })
    ).toThrow()
  })

  it("maps a SQL null purpose to undefined and back to null", () => {
    const account = LedgerAccountMapper.toDomain({
      ...row,
      system_purpose: null,
    })

    expect(account.systemPurpose).toBeUndefined()
    expect(LedgerAccountMapper.toPersistence(account).system_purpose).toBeNull()
  })

  it("accepts integer versions encoded as strings by the Tauri IPC adapter", () => {
    const account = LedgerAccountMapper.toDomain({ ...row, version: "2" })

    expect(account.version).toBe(2)
  })

  it("rejects invalid enum values before restoring the aggregate", () => {
    expect(() =>
      LedgerAccountMapper.toDomain({ ...row, kind: "BANK" })
    ).toThrow("Invalid ledger_accounts.kind")
    expect(() =>
      LedgerAccountMapper.toDomain({ ...row, status: "DELETED" })
    ).toThrow("Invalid ledger_accounts.status")
    expect(() =>
      LedgerAccountMapper.toDomain({ ...row, system_purpose: "OTHER" })
    ).toThrow("Invalid ledger_accounts.system_purpose")
  })

  it("rejects invalid strings and versions", () => {
    expect(() =>
      LedgerAccountMapper.toDomain({ ...row, normalized_name: " " })
    ).toThrow("Invalid ledger_accounts.normalized_name")
    expect(() => LedgerAccountMapper.toDomain({ ...row, version: -1 })).toThrow(
      "Invalid ledger_accounts.version"
    )
    expect(() => LedgerAccountMapper.toDomain({ ...row, name: 42 })).toThrow(
      "Invalid ledger_accounts.name"
    )
  })

  it("restores without collecting domain facts", () => {
    const account = LedgerAccountMapper.toDomain(row)

    expect(account.pullDomainFacts()).toEqual([])
  })
})
