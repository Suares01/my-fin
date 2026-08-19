import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  GetMonthlyCashFlowQuery,
  InsightQueries,
  MonthlyCashFlowItem,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseMonthRange,
  parseRequiredId,
} from "../../querying/query-validation.js"

export class GetMonthlyCashFlow {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InsightQueries
  ) {}

  public async execute(
    query: GetMonthlyCashFlowQuery
  ): Promise<ResultType<readonly MonthlyCashFlowItem[], ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const { fromMonth, toMonth } = parseMonthRange(
        query.fromMonth,
        query.toMonth
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
        await this.queries.getMonthlyCashFlow({
          bookId,
          fromMonth,
          toMonth,
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
