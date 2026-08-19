import {
  bookIdFromString,
  ledgerAccountIdFromString,
  LocalDate,
  Result,
} from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import type {
  AccountBalanceView,
  AccountBalanceQuery,
  LedgerAccountRepository,
  LedgerQueries,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { toQueryApplicationError } from "../../querying/query-error.js"

export class GetAccountBalance {
  constructor(
    private readonly accounts: LedgerAccountRepository,
    private readonly queries: LedgerQueries
  ) {}

  async execute(
    query: AccountBalanceQuery
  ): Promise<ResultType<AccountBalanceView, ApplicationError>> {
    try {
      const bookId = bookIdFromString(query.bookId)
      const accountId = ledgerAccountIdFromString(query.accountId)
      const account = await this.accounts.findById(accountId)
      if (account === null || account.bookId !== bookId) {
        return Result.fail(
          new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${query.accountId} was not found in book ${query.bookId}`
          )
        )
      }

      const asOf =
        query.asOf === undefined ? undefined : LocalDate.parse(query.asOf)
      const view = await this.queries.getAccountBalance({
        bookId,
        accountId,
        ...(asOf === undefined ? {} : { asOf }),
      })

      return Result.ok({
        accountId: view.accountId,
        accountName: view.accountName,
        accountKind: view.accountKind,
        rawBalanceMinor: view.rawBalanceMinor,
        displayBalanceMinor: view.displayBalanceMinor,
        asOf: view.asOf,
        amountMinor: view.amountMinor,
        currency: view.currency,
      })
    } catch (error: unknown) {
      return Result.fail(toQueryApplicationError(error))
    }
  }
}
