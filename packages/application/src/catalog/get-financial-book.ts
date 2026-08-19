import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import { toQueryApplicationError } from "../querying/query-error.js"
import { parseRequiredId } from "../querying/query-validation.js"
import type {
  BookCatalogQueries,
  FinancialBookSummary,
} from "./catalog-queries.js"

export interface GetFinancialBookInput {
  readonly bookId: string
}

export class GetFinancialBook {
  public constructor(private readonly queries: BookCatalogQueries) {}

  public async execute(
    input: GetFinancialBookInput
  ): Promise<ResultType<FinancialBookSummary, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(input.bookId, "bookId"))
      const book = await this.queries.getFinancialBook({ bookId })
      if (book === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${input.bookId} was not found`
          )
        )
      }

      return Result.ok(book)
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
