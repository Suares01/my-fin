import {
  bookIdFromString,
  ledgerAccountIdFromString,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  JournalEntryListItem,
  LedgerReadQueries,
  ListJournalEntriesQuery,
  QueryPage,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import {
  decodeJournalEntryCursor,
  encodeJournalEntryCursor,
} from "../../querying/cursor-codec.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseDateRange,
  parseIdList,
  parseJournalOrigins,
  parseLimit,
  parseRequiredId,
  parseSearch,
} from "../../querying/query-validation.js"

export class ListJournalEntries {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: LedgerReadQueries
  ) {}

  public async execute(
    query: ListJournalEntriesQuery
  ): Promise<ResultType<QueryPage<JournalEntryListItem>, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const { from, to } = parseDateRange(query.from, query.to)
      const accountIds = parseIdList(query.accountIds, "accountIds")
      const categoryIds = parseIdList(query.categoryIds, "categoryIds")
      const origins = parseJournalOrigins(query.origins)
      const search = parseSearch(query.search)
      const limit = parseLimit(query.limit)
      const cursor =
        query.cursor === undefined
          ? undefined
          : decodeJournalEntryCursor(query.cursor)
      const book = await this.books.findById(bookId)
      if (book === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${query.bookId} was not found`
          )
        )
      }

      const slice = await this.queries.listJournalEntries({
        bookId,
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
        ...(accountIds === undefined
          ? {}
          : {
              accountIds: accountIds.map((id) => ledgerAccountIdFromString(id)),
            }),
        ...(categoryIds === undefined
          ? {}
          : {
              categoryIds: categoryIds.map((id) =>
                ledgerAccountIdFromString(id)
              ),
            }),
        ...(origins === undefined ? {} : { origins }),
        ...(search === undefined ? {} : { search }),
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      })

      return Result.ok({
        items: slice.items,
        nextCursor:
          slice.nextKey === null
            ? null
            : encodeJournalEntryCursor(slice.nextKey),
      })
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
