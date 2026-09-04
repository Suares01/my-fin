import { bookIdFromString, LocalDate, Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  Clock,
  FinancialBookRepository,
  JournalChainListItem,
  JournalViewQueries,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { normalizeJournalChainFilters } from "../../querying/journal-chain-filters.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import type { ListJournalChainsQuery } from "../../querying/journal-chain-filters.js"
import { parseRequiredId } from "../../querying/query-validation.js"

export class ListJournalChains {
  public constructor(
    private readonly books: FinancialBookRepository,
    private readonly queries: JournalViewQueries,
    private readonly clock: Clock
  ) {}

  public async execute(
    query: ListJournalChainsQuery
  ): Promise<ResultType<readonly JournalChainListItem[], ApplicationError>> {
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

      const period =
        filters.from === undefined
          ? currentMonthPeriod(this.clock.localDate(book.timezone))
          : { from: filters.from, to: filters.to as LocalDate }
      return Result.ok(
        await this.queries.listJournalChains({ bookId, ...filters, ...period })
      )
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}

function currentMonthPeriod(today: string): {
  readonly from: LocalDate
  readonly to: LocalDate
} {
  const [yearText, monthText] = today.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: LocalDate.parse(`${yearText}-${monthText}-01`),
    to: LocalDate.parse(`${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`),
  }
}
