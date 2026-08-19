import {
  bookIdFromString,
  ledgerAccountIdFromString,
  LedgerAccount,
} from "@workspace/domain"
import type {
  AccountDto,
  ArchiveLedgerAccountCommand,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import type { TransactionManager } from "../../ports/transaction.js"

export class ArchiveLedgerAccount {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: ArchiveLedgerAccountCommand) {
    return executeUseCase<AccountDto>({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const book = await repositories.books.findById(
          bookIdFromString(command.bookId)
        )
        if (book === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${command.bookId} was not found`
          )
        }

        const account = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.accountId)
        )
        if (account === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.accountId} was not found`
          )
        }

        assertBook(account, book.id)
        assertExpectedVersion(account, command.expectedVersion)

        account.archive()
        if (account.version !== command.expectedVersion) {
          await repositories.accounts.save(account, command.expectedVersion)
        }

        return toAccountDto(account)
      },
    })
  }
}

function assertBook(
  account: LedgerAccount,
  bookId: LedgerAccount["bookId"]
): void {
  if (account.bookId !== bookId) {
    throw new ApplicationError(
      "BOOK_MISMATCH",
      "Ledger account does not belong to the requested book"
    )
  }
}

function assertExpectedVersion(
  account: LedgerAccount,
  expectedVersion: number
): void {
  if (account.version !== expectedVersion) {
    throw new ApplicationError(
      "OPTIMISTIC_CONCURRENCY_FAILURE",
      `Ledger account ${account.id} has a conflicting version`
    )
  }
}

function toAccountDto(account: LedgerAccount): AccountDto {
  return {
    id: account.id,
    bookId: account.bookId,
    name: account.name,
    kind: account.kind,
    status: account.status,
    version: account.version,
  }
}
