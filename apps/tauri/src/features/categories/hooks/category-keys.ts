export const categoryKeys = {
  all: (bookId: string) => ["books", bookId, "categories"] as const,
  list: (bookId: string, includeArchived: boolean) =>
    ["books", bookId, "categories", "list", includeArchived] as const,
  incomeCategories: (bookId: string) =>
    ["books", bookId, "income-categories"] as const,
  expenseCategories: (bookId: string) =>
    ["books", bookId, "expense-categories"] as const,
  detail: (bookId: string, categoryId: string) =>
    ["books", bookId, "categories", categoryId, "detail"] as const,
}
