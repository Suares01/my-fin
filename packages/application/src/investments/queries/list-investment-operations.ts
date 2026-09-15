import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InvestmentOperationHistoryItem,
  InvestmentQueries,
  QueryPage,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import { parseLimit, parseRequiredId } from "../../querying/query-validation.js"
export class ListInvestmentOperations {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InvestmentQueries
  ) {}
  public async execute(input: {
    readonly bookId: string
    readonly positionId: string
    readonly limit?: number
    readonly cursor?: string
  }): Promise<
    ResultType<QueryPage<InvestmentOperationHistoryItem>, ApplicationError>
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
        await this.queries.listOperations({
          bookId,
          positionId: parseRequiredId(input.positionId, "positionId"),
          limit: input.limit === undefined ? 25 : parseLimit(input.limit),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
