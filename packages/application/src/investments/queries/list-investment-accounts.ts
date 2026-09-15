import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InvestmentAccountQueries,
  InvestmentAccountView,
} from "../../ports/index.js"
import type { Clock } from "../../ports/time.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export class ListInvestmentAccounts {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InvestmentAccountQueries,
    private readonly clock: Clock
  ) {}

  public async execute(input: {
    readonly bookId: string
  }): Promise<ResultType<readonly InvestmentAccountView[], ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(input.bookId, "bookId"))
      const book = await this.books.findById(bookId)
      if (book === null)
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${input.bookId} was not found`
          )
        )
      return Result.ok(
        await this.queries.listInvestmentAccounts({
          bookId,
          currency: book.baseCurrency.code,
          asOf: this.clock.localDate(book.timezone),
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
