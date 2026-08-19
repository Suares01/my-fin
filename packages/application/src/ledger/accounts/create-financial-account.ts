import {
  bookIdFromString,
  LedgerAccount,
  normalizeAccountName,
} from "@workspace/domain"
import type {
  AccountDto,
  CreateFinancialAccountCommand,
  IdGenerator,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"

export class CreateFinancialAccount {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator
  ) {}

  async execute(command: CreateFinancialAccountCommand) {
    return executeUseCase({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const bookId = bookIdFromString(command.bookId)
        const book = await repositories.books.findById(bookId)
        if (book === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${command.bookId} was not found`
          )
        }

        if (command.kind !== "ASSET" && command.kind !== "LIABILITY") {
          throw new ApplicationError(
            "INVALID_ACCOUNT_KIND",
            "Financial accounts must be ASSET or LIABILITY"
          )
        }

        const normalizedName = normalizeAccountName(command.name)
        if (
          await repositories.accounts.existsWithName(
            book.id,
            command.kind,
            normalizedName
          )
        ) {
          throw new ApplicationError(
            "DUPLICATE_ENTITY",
            `Financial account ${command.name} already exists`
          )
        }

        const account = LedgerAccount.create({
          id: this.ids.nextLedgerAccountId(),
          bookId: book.id,
          name: command.name,
          kind: command.kind,
        })
        await repositories.accounts.add(account)
        return toAccountDto(account)
      },
    })
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
