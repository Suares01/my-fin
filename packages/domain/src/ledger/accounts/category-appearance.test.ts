import { describe, expect, it } from "vitest"
import {
  categoryAppearance,
  isManagedCategoryAccount,
  LedgerAccount,
} from "./index.js"
import {
  bookIdFromString,
  ledgerAccountIdFromString,
} from "../../shared/identity/ids.js"

const bookId = bookIdFromString("book-1")

function category(kind: "INCOME" | "EXPENSE" = "EXPENSE") {
  return LedgerAccount.create({
    id: ledgerAccountIdFromString(`category-${kind}`),
    bookId,
    name: "Food",
    kind,
    iconKey: "label-dollar",
    colorHex: "F43F5E",
  })
}

describe("category appearance", () => {
  it("accepts a slug and canonicalizes an uppercase color", () => {
    expect(
      categoryAppearance({ iconKey: "food-dining", colorHex: "F43F5E" })
    ).toEqual({ iconKey: "food-dining", colorHex: "f43f5e" })
  })

  it.each(["", "food dining", "Food", "-food", "food-", "food--dining"])(
    "rejects an invalid icon key: %s",
    (iconKey) => {
      expect(() => categoryAppearance({ iconKey, colorHex: "f43f5e" })).toThrowError(
        expect.objectContaining({ code: "INVALID_CATEGORY_ICON_KEY" })
      )
    }
  )

  it.each(["", "#f43f5e", "f43", "f43f5e99", "f43f5g", "f43f5e "])(
    "rejects a non-canonical color: %s",
    (colorHex) => {
      expect(() => categoryAppearance({ iconKey: "food", colorHex })).toThrowError(
        expect.objectContaining({ code: "INVALID_CATEGORY_COLOR" })
      )
    }
  )

  it("requires appearance when creating a managed category", () => {
    expect(() =>
      LedgerAccount.create({
        id: ledgerAccountIdFromString("missing-appearance"),
        bookId,
        name: "Food",
        kind: "EXPENSE",
      })
    ).toThrowError(expect.objectContaining({ code: "CATEGORY_APPEARANCE_REQUIRED" }))
  })

  it("rejects appearance on a financial account", () => {
    expect(() =>
      LedgerAccount.create({
        id: ledgerAccountIdFromString("cash-with-appearance"),
        bookId,
        name: "Cash",
        kind: "ASSET",
        iconKey: "cash",
        colorHex: "10b981",
      })
    ).toThrowError(expect.objectContaining({ code: "CATEGORY_APPEARANCE_FORBIDDEN" }))
  })

  it("rejects appearance on a system account", () => {
    expect(() =>
      LedgerAccount.create({
        id: ledgerAccountIdFromString("system-with-appearance"),
        bookId,
        name: "Uncategorized",
        kind: "EXPENSE",
        systemPurpose: "UNCATEGORIZED_EXPENSE",
        iconKey: "cash",
        colorHex: "10b981",
      })
    ).toThrowError(expect.objectContaining({ code: "CATEGORY_APPEARANCE_FORBIDDEN" }))
  })

  it("identifies only non-system income and expense accounts as managed", () => {
    expect(isManagedCategoryAccount(category("INCOME"))).toBe(true)
    expect(isManagedCategoryAccount(category("EXPENSE"))).toBe(true)
    expect(
      isManagedCategoryAccount(
        LedgerAccount.create({
          id: ledgerAccountIdFromString("system-category"),
          bookId,
          name: "Uncategorized",
          kind: "EXPENSE",
          systemPurpose: "UNCATEGORIZED_EXPENSE",
        })
      )
    ).toBe(false)
  })

  it("creates a category snapshot and fact with canonical appearance", () => {
    const account = category()

    expect(account.toSnapshot()).toMatchObject({
      kind: "EXPENSE",
      iconKey: "label-dollar",
      colorHex: "f43f5e",
      version: 0,
    })
    expect(account.pullDomainFacts()).toEqual([
      expect.objectContaining({
        type: "LedgerAccountCreated",
        payload: expect.objectContaining({
          iconKey: "label-dollar",
          colorHex: "f43f5e",
        }),
      }),
    ])
  })

  it("updates category name and appearance in one version and fact", () => {
    const account = category()
    account.pullDomainFacts()

    account.updateCategory({
      name: "  Dining  ",
      iconKey: "restaurant",
      colorHex: "ABCDEF",
    })

    expect(account.toSnapshot()).toMatchObject({
      name: "Dining",
      normalizedName: "dining",
      iconKey: "restaurant",
      colorHex: "abcdef",
      version: 1,
    })
    expect(account.pullDomainFacts()).toEqual([
      expect.objectContaining({
        type: "CategoryUpdated",
        aggregateId: "category-EXPENSE",
        aggregateVersion: 1,
        payload: expect.objectContaining({
          name: "Dining",
          normalizedName: "dining",
          iconKey: "restaurant",
          colorHex: "abcdef",
        }),
      }),
    ])
  })

  it("treats an identical category update as a no-op", () => {
    const account = category()
    const before = account.toSnapshot()

    account.updateCategory({
      name: " Food ",
      iconKey: "label-dollar",
      colorHex: "f43f5e",
    })

    expect(account.toSnapshot()).toEqual(before)
    expect(account.pullDomainFacts()).toHaveLength(1)
  })

  it("restores appearance without creating a fact", () => {
    const account = category()
    account.pullDomainFacts()
    const snapshot = { ...account.toSnapshot(), version: 3 }

    const restored = LedgerAccount.restore(snapshot)

    expect(restored.toSnapshot()).toEqual(snapshot)
    expect(restored.pullDomainFacts()).toEqual([])
  })

  it("rejects an invalid update before mutating the category", () => {
    const account = category()
    const before = account.toSnapshot()
    account.pullDomainFacts()

    expect(() =>
      account.updateCategory({
        name: "Updated",
        iconKey: "invalid icon",
        colorHex: "f43f5e",
      })
    ).toThrowError(expect.objectContaining({ code: "INVALID_CATEGORY_ICON_KEY" }))

    expect(account.toSnapshot()).toEqual(before)
    expect(account.pullDomainFacts()).toEqual([])
  })
})
