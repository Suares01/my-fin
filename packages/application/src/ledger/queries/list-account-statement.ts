import {
  bookIdFromString,
  ledgerAccountIdFromString,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  AccountStatementItem,
  LedgerAccountRepository,
  LedgerReadQueries,
  ListAccountStatementQuery,
  QueryPage,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import {
  encodeStatementCursor,
  decodeStatementCursor,
} from "../../querying/cursor-codec.js"
import { toQueryApplicationError } from "../../querying/query-error.js"
import {
  parseDateRange,
  parseLimit,
  parseRequiredId,
} from "../../querying/query-validation.js"

export class ListAccountStatement {
  public constructor(
    private readonly accounts: LedgerAccountRepository,
    private readonly queries: LedgerReadQueries
  ) {}

  public async execute(
    query: ListAccountStatementQuery
  ): Promise<ResultType<QueryPage<AccountStatementItem>, ApplicationError>> {
    try {
      const bookId = bookIdFromString(parseRequiredId(query.bookId, "bookId"))
      const accountId = ledgerAccountIdFromString(
        parseRequiredId(query.accountId, "accountId")
      )
      const { from, to } = parseDateRange(query.from, query.to)
      const limit = parseLimit(query.limit)
      const cursor =
        query.cursor === undefined
          ? undefined
          : decodeStatementCursor(query.cursor)
      const account = await this.accounts.findById(accountId)
      if (account === null || account.bookId !== bookId) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${query.accountId} was not found in book ${query.bookId}`
          )
        )
      }

      const slice = await this.queries.listAccountStatement({
        bookId,
        accountId,
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      })

      return Result.ok({
        items: slice.items,
        nextCursor:
          slice.nextKey === null ? null : encodeStatementCursor(slice.nextKey),
      })
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
