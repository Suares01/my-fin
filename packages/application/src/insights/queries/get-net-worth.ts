import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  GetNetWorthQuery,
  InsightQueries,
  NetWorthView,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseOptionalDate,
  parseRequiredId,
} from "../../querying/query-validation.js"

export class GetNetWorth {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InsightQueries
  ) {}

  public async execute(
    query: GetNetWorthQuery
  ): Promise<ResultType<NetWorthView, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const asOf = parseOptionalDate(query.asOf, "asOf")
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
        await this.queries.getNetWorth({
          bookId,
          ...(asOf === undefined ? {} : { asOf }),
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
