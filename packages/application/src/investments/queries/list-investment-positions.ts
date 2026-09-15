import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  InvestmentPositionView,
  InvestmentQueries,
  QueryPage,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseLimit,
  parseRequiredId,
  parseSearch,
} from "../../querying/query-validation.js"

export class ListInvestmentPositions {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: InvestmentQueries
  ) {}
  public async execute(input: {
    readonly bookId: string
    readonly accountId?: string
    readonly assetClass?: string
    readonly status?: "OPEN" | "CLOSED"
    readonly search?: string
    readonly limit?: number
    readonly cursor?: string
  }): Promise<ResultType<QueryPage<InvestmentPositionView>, ApplicationError>> {
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
        await this.queries.listPositions({
          bookId,
          ...(input.accountId === undefined
            ? {}
            : { accountId: parseRequiredId(input.accountId, "accountId") }),
          ...(input.assetClass === undefined
            ? {}
            : { assetClass: input.assetClass }),
          status: input.status ?? "OPEN",
          ...(input.search === undefined
            ? {}
            : { search: parseSearch(input.search) }),
          limit: input.limit === undefined ? 25 : parseLimit(input.limit),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
