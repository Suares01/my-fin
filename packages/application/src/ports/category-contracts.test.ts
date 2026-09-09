import { describe, expect, it } from "vitest"
import type {
  AccountDto,
  ArchiveCategoryCommand,
  CategoryDto,
  CreateCategoryCommand,
  ReactivateCategoryCommand,
  UpdateCategoryCommand,
} from "./index.js"
import type {
  ExpenseCategorySummary,
  IncomeCategorySummary,
} from "../catalog/catalog-queries.js"

describe("category management contracts", () => {
  it("requires a literal kind and complete appearance on create", () => {
    const command: CreateCategoryCommand = {
      bookId: "book-1",
      name: " Food ",
      kind: "EXPENSE",
      iconKey: "food-dining",
      colorHex: "f43f5e",
    }

    expect(command).toEqual({
      bookId: "book-1",
      name: " Food ",
      kind: "EXPENSE",
      iconKey: "food-dining",
      colorHex: "f43f5e",
    })
  })

  it("uses categoryId and expectedVersion on the dedicated lifecycle commands", () => {
    const update: UpdateCategoryCommand = {
      bookId: "book-1",
      categoryId: "category-1",
      expectedVersion: 4,
      name: "Dining",
      iconKey: "restaurant",
      colorHex: "abcdef",
    }
    const archive: ArchiveCategoryCommand = {
      bookId: "book-1",
      categoryId: "category-1",
      expectedVersion: 4,
    }
    const reactivate: ReactivateCategoryCommand = archive

    expect(update).toMatchObject({
      categoryId: "category-1",
      expectedVersion: 4,
      iconKey: "restaurant",
      colorHex: "abcdef",
    })
    expect(archive.categoryId).toBe("category-1")
    expect(reactivate.categoryId).toBe("category-1")
  })

  it("requires appearance in category views without adding it to AccountDto", () => {
    const dto: CategoryDto = {
      id: "category-1",
      bookId: "book-1",
      name: "Dining",
      kind: "EXPENSE",
      status: "ACTIVE",
      iconKey: "restaurant",
      colorHex: "abcdef",
      version: 4,
    }
    const income: IncomeCategorySummary = {
      id: "income-1",
      name: "Salary",
      kind: "INCOME",
      iconKey: "briefcase",
      colorHex: "10b981",
    }
    const expense: ExpenseCategorySummary = {
      id: "expense-1",
      name: "Dining",
      kind: "EXPENSE",
      iconKey: "restaurant",
      colorHex: "abcdef",
    }
    const account: AccountDto = {
      id: "account-1",
      bookId: "book-1",
      name: "Cash",
      kind: "ASSET",
      status: "ACTIVE",
      version: 1,
    }

    expect(dto).toMatchObject({ iconKey: "restaurant", colorHex: "abcdef" })
    expect(income).toMatchObject({ iconKey: "briefcase", colorHex: "10b981" })
    expect(expense).toMatchObject({ iconKey: "restaurant", colorHex: "abcdef" })
    expect("iconKey" in account).toBe(false)
    expect("colorHex" in account).toBe(false)
  })
})
