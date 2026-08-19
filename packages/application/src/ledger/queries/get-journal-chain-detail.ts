import {
  bookIdFromString,
  journalEntryIdFromString,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  FinancialBookRepository,
  JournalChainDetail,
  JournalViewQueries,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export interface GetJournalChainDetailQuery {
  readonly bookId: string
  readonly entryId: string
}

export class GetJournalChainDetail {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: JournalViewQueries
  ) {}

  public async execute(
    query: GetJournalChainDetailQuery
  ): Promise<ResultType<JournalChainDetail, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const entryId = journalEntryIdFromString(
        parseRequiredId(query.entryId, "entryId")
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

      const detail = await this.queries.getJournalChainDetail({
        bookId,
        entryId,
      })
      if (detail === null) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Journal chain ${query.entryId} was not found`
          )
        )
      }

      return Result.ok(detail)
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
