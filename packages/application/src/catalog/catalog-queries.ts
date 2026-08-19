import type { BookId } from "@workspace/domain"

export interface FinancialBookSummary {
  readonly id: string
  readonly name: string
  readonly baseCurrency: string
  readonly timezone: string
}

export interface ExpenseCategorySummary {
  readonly id: string
  readonly name: string
  readonly kind: "EXPENSE"
}

export interface IncomeCategorySummary {
  readonly id: string
  readonly name: string
  readonly kind: "INCOME"
}

export interface CategorySummary {
  readonly id: string
  readonly name: string
  readonly kind: "INCOME" | "EXPENSE"
  readonly status: "ACTIVE" | "ARCHIVED"
  readonly version: number
}

export interface BookCatalogQueries {
  listFinancialBooks(): Promise<readonly FinancialBookSummary[]>
  getFinancialBook(input: {
    readonly bookId: BookId
  }): Promise<FinancialBookSummary | null>
}

export interface CategoryCatalogQueries {
  listExpenseCategories(input: {
    readonly bookId: BookId
  }): Promise<readonly ExpenseCategorySummary[]>
  listIncomeCategories(input: {
    readonly bookId: BookId
  }): Promise<readonly IncomeCategorySummary[]>
  listCategories(input: {
    readonly bookId: BookId
    readonly includeArchived: boolean
  }): Promise<readonly CategorySummary[]>
  getCategoryDetail(input: {
    readonly bookId: BookId
    readonly categoryId: import("@workspace/domain").LedgerAccountId
  }): Promise<CategorySummary | null>
}
