import {
  bookIdFromString,
  ledgerAccountIdFromString,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type { FinancialBookRepository } from "../ports/repositories.js"
import { toQueryApplicationError } from "../querying/query-error.js"
import { parseRequiredId } from "../querying/query-validation.js"
import type {
  CategoryCatalogQueries,
  CategorySummary,
} from "./catalog-queries.js"

export interface GetCategoryDetailInput {
  readonly bookId: string
  readonly categoryId: string
}

export class GetCategoryDetail {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: CategoryCatalogQueries
  ) {}

  public async execute(
    input: GetCategoryDetailInput
  ): Promise<ResultType<CategorySummary, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(input.bookId, "bookId"))
      const categoryId = ledgerAccountIdFromString(
        parseRequiredId(input.categoryId, "categoryId")
      )
      const book = await this.books.findById(bookId)
      if (book === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${input.bookId} was not found`
          )
        )
      }

      const category = await this.queries.getCategoryDetail({
        bookId,
        categoryId,
      })
      if (category === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Category ${input.categoryId} was not found`
          )
        )
      }

      return Result.ok(category)
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
