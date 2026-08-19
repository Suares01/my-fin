import { bookIdFromString, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  JournalChainListItem,
  JournalViewQueries,
  QueryPage,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import {
  encodeJournalChainCursor,
  normalizeJournalChainFilters,
} from "../../querying/journal-chain-filters.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import type { ListJournalChainsQuery } from "../../querying/journal-chain-filters.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export class ListJournalChains {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: JournalViewQueries
  ) {}

  public async execute(
    query: ListJournalChainsQuery
  ): Promise<ResultType<QueryPage<JournalChainListItem>, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const filters = normalizeJournalChainFilters(query)
      const book = await this.books.findById(bookId)
      if (book === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${query.bookId} was not found`
          )
        )
      }

      const slice = await this.queries.listJournalChains({ bookId, ...filters })
      return Result.ok({
        items: slice.items,
        nextCursor:
          slice.nextKey === null
            ? null
            : encodeJournalChainCursor(slice.nextKey),
      })
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
