import {
  bookIdFromString,
  ledgerAccountIdFromString,
  Result,
} from "@workspace/domain"
import type { FinancialBookRepository } from "../ports/index.js"
import { ApplicationError } from "../ports/errors.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ListExpenseCategories } from "./list-expense-categories.js"
import type {
  CategorySummary,
  BookCatalogQueries,
  CategoryCatalogQueries,
  ExpenseCategorySummary,
  FinancialBookSummary,
} from "./catalog-queries.js"
import { GetCategoryDetail } from "./get-category-detail.js"
import { ListCategories } from "./list-categories.js"
import { ListIncomeCategories } from "./list-income-categories.js"
import { ListFinancialBooks } from "./list-financial-books.js"
import { GetFinancialBook } from "./get-financial-book.js"

const books = {
  findById: vi.fn(),
} as unknown as FinancialBookRepository

const bookSummaries: readonly FinancialBookSummary[] = [
  {
    id: "book-1",
    name: "Casa",
    baseCurrency: "BRL",
    timezone: "America/Sao_Paulo",
  },
]

const categorySummaries: readonly ExpenseCategorySummary[] = [
  {
    id: "category-1",
    name: "Mercado",
    kind: "EXPENSE",
    iconKey: "label-dollar",
    colorHex: "f43f5e",
  },
]

const managedCategories: readonly CategorySummary[] = [
  {
    id: "income-1",
    name: "Salário",
    kind: "INCOME",
    status: "ACTIVE",
    iconKey: "briefcase",
    colorHex: "10b981",
    version: 0,
  },
  {
    id: "expense-1",
    name: "Mercado",
    kind: "EXPENSE",
    status: "ARCHIVED",
    iconKey: "label-dollar",
    colorHex: "f43f5e",
    version: 2,
  },
]

function createCategoryQueries(
  overrides: Partial<CategoryCatalogQueries> = {}
): CategoryCatalogQueries {
  return {
    listExpenseCategories: vi.fn(),
    listIncomeCategories: vi.fn(),
    listCategories: vi.fn(),
    getCategoryDetail: vi.fn(),
    ...overrides,
  }
}

function createBookQueries(
  overrides: Partial<BookCatalogQueries> = {}
): BookCatalogQueries {
  return {
    listFinancialBooks: vi.fn(),
    getFinancialBook: vi.fn(),
    ...overrides,
  }
}

describe("catalog query handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the exact financial book summaries from the port", async () => {
    const queries = createBookQueries({
      listFinancialBooks: vi.fn().mockResolvedValue(bookSummaries),
    })

    const result = await new ListFinancialBooks(queries).execute()

    expect(result).toEqual(Result.ok(bookSummaries))
    expect(queries.listFinancialBooks).toHaveBeenCalledOnce()
  })

  it("returns an empty book catalog without inventing a selection", async () => {
    const queries = createBookQueries({
      listFinancialBooks: vi.fn().mockResolvedValue([]),
    })

    const result = await new ListFinancialBooks(queries).execute()

    expect(result).toEqual(Result.ok([]))
  })

  it("maps an unexpected book driver failure to a safe application error", async () => {
    const queries = createBookQueries({
      listFinancialBooks: vi
        .fn()
        .mockRejectedValue(
          new Error("SELECT secret FROM /private/books.sqlite")
        ),
    })

    const result = await new ListFinancialBooks(queries).execute()

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
  })

  it("returns exact expense category summaries for an existing book", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listExpenseCategories: vi.fn().mockResolvedValue(categorySummaries),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(Result.ok(categorySummaries))
    expect(queries.listExpenseCategories).toHaveBeenCalledWith({
      bookId: bookIdFromString("book-1"),
    })
  })

  it("returns an empty expense category catalog", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listExpenseCategories: vi.fn().mockResolvedValue([]),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(Result.ok([]))
  })

  it("rejects a missing book before querying categories", async () => {
    vi.mocked(books.findById).mockResolvedValue(null)
    const queries = createCategoryQueries({
      listExpenseCategories: vi.fn(),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "book-missing",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "ENTITY_NOT_FOUND",
          "Financial book book-missing was not found"
        )
      )
    )
    expect(queries.listExpenseCategories).not.toHaveBeenCalled()
  })

  it("rejects a blank book id as an invalid query", async () => {
    const queries = createCategoryQueries({
      listExpenseCategories: vi.fn(),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "   ",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "INVALID_QUERY",
          "Invalid financial query field: bookId"
        )
      )
    )
    expect(books.findById).not.toHaveBeenCalled()
  })

  it("does not cross the validated book boundary", async () => {
    vi.mocked(books.findById).mockResolvedValue(null)
    const queries = createCategoryQueries({
      listExpenseCategories: vi.fn().mockResolvedValue(categorySummaries),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "book-other",
    })

    expect(result.ok).toBe(false)
    expect(queries.listExpenseCategories).not.toHaveBeenCalled()
  })

  it("maps an unexpected category driver failure to a safe error", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listExpenseCategories: vi
        .fn()
        .mockRejectedValue(
          new Error("SQL SELECT secret /private/categories.sqlite")
        ),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
  })

  it("preserves a safe query boundary when the repository fails", async () => {
    vi.mocked(books.findById).mockRejectedValue(
      new Error("repository path secret")
    )
    const queries = createCategoryQueries({
      listExpenseCategories: vi.fn(),
    })

    const result = await new ListExpenseCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
    expect(queries.listExpenseCategories).not.toHaveBeenCalled()
  })

  it("returns exact income selector summaries for an existing book", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const summaries = [
      { id: "income-1", name: "Salário", kind: "INCOME" as const },
    ]
    const queries = createCategoryQueries({
      listIncomeCategories: vi.fn().mockResolvedValue(summaries),
    })

    const result = await new ListIncomeCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(Result.ok(summaries))
    expect(queries.listIncomeCategories).toHaveBeenCalledWith({
      bookId: bookIdFromString("book-1"),
    })
  })

  it("returns an empty income selector without inventing categories", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listIncomeCategories: vi.fn().mockResolvedValue([]),
    })

    await expect(
      new ListIncomeCategories(books, queries).execute({ bookId: "book-1" })
    ).resolves.toEqual(Result.ok([]))
  })

  it("rejects income listing for a missing book before querying", async () => {
    vi.mocked(books.findById).mockResolvedValue(null)
    const queries = createCategoryQueries()

    const result = await new ListIncomeCategories(books, queries).execute({
      bookId: "missing",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "ENTITY_NOT_FOUND",
          "Financial book missing was not found"
        )
      )
    )
    expect(queries.listIncomeCategories).not.toHaveBeenCalled()
  })

  it("rejects a blank income-list book id before repository access", async () => {
    const queries = createCategoryQueries()

    const result = await new ListIncomeCategories(books, queries).execute({
      bookId: " ",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "INVALID_QUERY",
          "Invalid financial query field: bookId"
        )
      )
    )
    expect(books.findById).not.toHaveBeenCalled()
  })

  it("sanitizes an income selector failure", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listIncomeCategories: vi
        .fn()
        .mockRejectedValue(new Error("private SQL path")),
    })

    const result = await new ListIncomeCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
  })

  it("returns both category kinds and lifecycle fields by default", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listCategories: vi.fn().mockResolvedValue(managedCategories),
    })

    const result = await new ListCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(Result.ok(managedCategories))
    expect(queries.listCategories).toHaveBeenCalledWith({
      bookId: bookIdFromString("book-1"),
      includeArchived: true,
    })
  })

  it("forwards the active-only category directory option", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listCategories: vi.fn().mockResolvedValue([]),
    })

    await new ListCategories(books, queries).execute({
      bookId: "book-1",
      includeArchived: false,
    })

    expect(queries.listCategories).toHaveBeenCalledWith({
      bookId: bookIdFromString("book-1"),
      includeArchived: false,
    })
  })

  it("rejects the category directory for a missing book", async () => {
    vi.mocked(books.findById).mockResolvedValue(null)
    const queries = createCategoryQueries()

    const result = await new ListCategories(books, queries).execute({
      bookId: "missing",
    })

    expect(result.ok).toBe(false)
    expect(queries.listCategories).not.toHaveBeenCalled()
  })

  it("rejects a blank category-directory book id", async () => {
    const queries = createCategoryQueries()

    const result = await new ListCategories(books, queries).execute({
      bookId: "",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "INVALID_QUERY",
          "Invalid financial query field: bookId"
        )
      )
    )
    expect(books.findById).not.toHaveBeenCalled()
  })

  it("sanitizes a category-directory failure", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      listCategories: vi.fn().mockRejectedValue(new Error("private SQL path")),
    })

    const result = await new ListCategories(books, queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
  })

  it("returns exact category detail fields for an archived category", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      getCategoryDetail: vi.fn().mockResolvedValue(managedCategories[1]),
    })

    const result = await new GetCategoryDetail(books, queries).execute({
      bookId: "book-1",
      categoryId: "expense-1",
    })

    expect(result).toEqual(Result.ok(managedCategories[1]))
    expect(queries.getCategoryDetail).toHaveBeenCalledWith({
      bookId: bookIdFromString("book-1"),
      categoryId: ledgerAccountIdFromString("expense-1"),
    })
  })

  it("returns a stable missing-category error without leaking query details", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      getCategoryDetail: vi.fn().mockResolvedValue(null),
    })

    const result = await new GetCategoryDetail(books, queries).execute({
      bookId: "book-1",
      categoryId: "category-missing",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "ENTITY_NOT_FOUND",
          "Category category-missing was not found"
        )
      )
    )
  })

  it("does not query category detail across a missing book boundary", async () => {
    vi.mocked(books.findById).mockResolvedValue(null)
    const queries = createCategoryQueries({ getCategoryDetail: vi.fn() })

    const result = await new GetCategoryDetail(books, queries).execute({
      bookId: "other-book",
      categoryId: "category-1",
    })

    expect(result.ok).toBe(false)
    expect(queries.getCategoryDetail).not.toHaveBeenCalled()
  })

  it("rejects invalid category detail ids before repository access", async () => {
    const queries = createCategoryQueries()

    const result = await new GetCategoryDetail(books, queries).execute({
      bookId: "book-1",
      categoryId: " ",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "INVALID_QUERY",
          "Invalid financial query field: categoryId"
        )
      )
    )
    expect(books.findById).not.toHaveBeenCalled()
  })

  it("sanitizes category detail port failures", async () => {
    vi.mocked(books.findById).mockResolvedValue({} as never)
    const queries = createCategoryQueries({
      getCategoryDetail: vi
        .fn()
        .mockRejectedValue(new Error("private SQL path")),
    })

    const result = await new GetCategoryDetail(books, queries).execute({
      bookId: "book-1",
      categoryId: "category-1",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
  })

  it("returns the exact financial book detail summary", async () => {
    const queries = createBookQueries({
      getFinancialBook: vi.fn().mockResolvedValue(bookSummaries[0]),
    })

    const result = await new GetFinancialBook(queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(Result.ok(bookSummaries[0]))
    expect(queries.getFinancialBook).toHaveBeenCalledWith({
      bookId: bookIdFromString("book-1"),
    })
  })

  it("preserves exact base currency and IANA timezone values", async () => {
    const summary = {
      id: "book-1",
      name: "Casa",
      baseCurrency: "USD",
      timezone: "America/New_York",
    }
    const queries = createBookQueries({
      getFinancialBook: vi.fn().mockResolvedValue(summary),
    })

    const result = await new GetFinancialBook(queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(Result.ok(summary))
  })

  it("maps a missing financial book to a stable not-found error", async () => {
    const queries = createBookQueries({
      getFinancialBook: vi.fn().mockResolvedValue(null),
    })

    const result = await new GetFinancialBook(queries).execute({
      bookId: "missing",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "ENTITY_NOT_FOUND",
          "Financial book missing was not found"
        )
      )
    )
  })

  it("rejects a blank book detail id before port access", async () => {
    const queries = createBookQueries()

    const result = await new GetFinancialBook(queries).execute({ bookId: " " })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError(
          "INVALID_QUERY",
          "Invalid financial query field: bookId"
        )
      )
    )
    expect(queries.getFinancialBook).not.toHaveBeenCalled()
  })

  it("sanitizes an unexpected book detail failure", async () => {
    const queries = createBookQueries({
      getFinancialBook: vi
        .fn()
        .mockRejectedValue(new Error("private SQLite path")),
    })

    const result = await new GetFinancialBook(queries).execute({
      bookId: "book-1",
    })

    expect(result).toEqual(
      Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    )
  })
})
