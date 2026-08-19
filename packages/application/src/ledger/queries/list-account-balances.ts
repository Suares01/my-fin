import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  AccountBalanceItemView,
  FinancialBookRepository,
  LedgerReadQueries,
  ListAccountBalancesQuery,
  QueryPage,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseAccountKinds,
  parseOptionalDate,
  parseRequiredId,
} from "../../querying/query-validation.js"

export class ListAccountBalances {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: LedgerReadQueries
  ) {}

  public async execute(
    query: ListAccountBalancesQuery
  ): Promise<ResultType<QueryPage<AccountBalanceItemView>, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const accountKinds = parseAccountKinds(query.accountKinds)
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

      if (accountKinds !== undefined && accountKinds.length === 0) {
        return Result.ok({ items: [], nextCursor: null })
      }

      const items = await this.queries.listAccountBalances({
        bookId,
        ...(accountKinds === undefined ? {} : { accountKinds }),
        ...(asOf === undefined ? {} : { asOf }),
        includeArchived: query.includeArchived ?? false,
        includeZeroBalance: query.includeZeroBalance ?? true,
      })

      return Result.ok({ items, nextCursor: null })
    } catch (error: unknown) {
      console.error("[ListAccountBalances] erro original:", error)

      return Result.fail(toQueryApplicationError(error))
    }
  }
}
