import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InvestmentPortfolioSummary,
  InvestmentPortfolioSummaryQueries,
} from "../../ports/index.js"
import type { Clock } from "../../ports/time.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export class GetInvestmentPortfolioSummary {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InvestmentPortfolioSummaryQueries,
    private readonly clock: Clock
  ) {}

  public async execute(input: {
    readonly bookId: string
  }): Promise<ResultType<InvestmentPortfolioSummary, ApplicationError>> {
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

      const asOf = this.clock.localDate(book.timezone)
      return Result.ok(
        await this.queries.getPortfolioSummary({
          bookId,
          currency: book.baseCurrency.code,
          asOf,
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
