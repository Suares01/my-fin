import {
  bookIdFromString,
  ledgerAccountIdFromString,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  CategorySpendingItem,
  FinancialBookRepository,
  GetCategorySpendingQuery,
  InsightQueries,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseDateRange,
  parseRequiredId,
} from "../../querying/query-validation.js"

export class GetCategorySpending {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InsightQueries
  ) {}

  public async execute(
    query: GetCategorySpendingQuery
  ): Promise<ResultType<readonly CategorySpendingItem[], ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const { from, to } = parseDateRange(query.from, query.to)
      if (from === undefined || to === undefined) {
        throw new ApplicationError(
          "INVALID_QUERY",
          "Financial query field from/to is required"
        )
      }
      const categoryId =
        query.categoryId === undefined
          ? undefined
          : ledgerAccountIdFromString(
              parseRequiredId(query.categoryId, "categoryId")
            )
      const book = await this.books.findById(bookId)
      if (book === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${query.bookId} was not found`
          )
        )
      }

      return Result.ok(
        await this.queries.getCategorySpending({
          bookId,
          from,
          to,
          ...(categoryId === undefined ? {} : { categoryId }),
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
