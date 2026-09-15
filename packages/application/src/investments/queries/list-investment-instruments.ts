import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InvestmentInstrumentQueries,
  InvestmentInstrumentView,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export class ListInvestmentInstruments {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InvestmentInstrumentQueries
  ) {}
  public async execute(input: {
    readonly bookId: string
    readonly status?: "ACTIVE" | "ARCHIVED"
  }): Promise<
    ResultType<readonly InvestmentInstrumentView[], ApplicationError>
  > {
    try {
      const bookId = bookIdFromString(parseRequiredId(input.bookId, "bookId"))
      if ((await this.books.findById(bookId)) === null)
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${input.bookId} was not found`
          )
        )
      return Result.ok(
        await this.queries.listInvestmentInstruments({
          bookId,
          ...(input.status === undefined ? {} : { status: input.status }),
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
