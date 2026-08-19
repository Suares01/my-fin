import {
  bookIdFromString,
  LedgerAccount,
  normalizeAccountName,
} from "@workspace/domain"
import type {
  CreateCategoryCommand,
  IdGenerator,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"

export class CreateExpenseCategory {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator
  ) {}

  async execute(command: CreateCategoryCommand) {
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

        if (command.kind !== "EXPENSE") {
          throw new ApplicationError(
            "INVALID_ACCOUNT_KIND",
            "Expense categories must be EXPENSE"
          )
        }

        if (
          await repositories.accounts.existsWithName(
            book.id,
            "EXPENSE",
            normalizeAccountName(command.name)
          )
        ) {
          throw new ApplicationError(
            "DUPLICATE_ENTITY",
            `Expense category ${command.name} already exists`
          )
        }

        const category = LedgerAccount.create({
          id: this.ids.nextLedgerAccountId(),
          bookId: book.id,
          name: command.name,
          kind: "EXPENSE",
        })
        await repositories.accounts.add(category)
        return {
          id: category.id,
          bookId: category.bookId,
          name: category.name,
          kind: category.kind,
          status: category.status,
          version: category.version,
        }
      },
    })
  }
}
