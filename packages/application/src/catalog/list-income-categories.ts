import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type { FinancialBookRepository } from "../ports/repositories.js"
import { toQueryApplicationError } from "../querying/query-error.js"
import { parseRequiredId } from "../querying/query-validation.js"
import type {
  CategoryCatalogQueries,
  IncomeCategorySummary,
} from "./catalog-queries.js"

export interface ListIncomeCategoriesInput {
  readonly bookId: string
}

export class ListIncomeCategories {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: CategoryCatalogQueries
  ) {}

  public async execute(
    input: ListIncomeCategoriesInput
  ): Promise<ResultType<readonly IncomeCategorySummary[], ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(input.bookId, "bookId"))
      const book = await this.books.findById(bookId)
      if (book === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${input.bookId} was not found`
          )
        )
      }

      return Result.ok(await this.queries.listIncomeCategories({ bookId }))
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
