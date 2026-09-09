import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  JournalChainSummary,
  JournalViewQueries,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import {
  normalizeJournalChainSummaryFilters,
  type GetJournalChainSummaryQuery,
} from "../../querying/journal-chain-filters.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export class GetJournalChainSummary {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: JournalViewQueries
  ) {}

  public async execute(
    query: GetJournalChainSummaryQuery
  ): Promise<ResultType<JournalChainSummary, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const filters = normalizeJournalChainSummaryFilters(query)
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
        await this.queries.getJournalChainSummary({ bookId, ...filters })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
