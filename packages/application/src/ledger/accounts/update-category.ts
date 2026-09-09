import {
  bookIdFromString,
  isManagedCategoryAccount,
  ledgerAccountIdFromString,
  LedgerAccount,
  normalizeAccountName,
} from "@workspace/domain"
import type {
  CategoryDto,
  TransactionManager,
  UpdateCategoryCommand,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"

export class UpdateCategory {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: UpdateCategoryCommand) {
    return executeUseCase<CategoryDto>({
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

        const category = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.categoryId)
        )
        if (category === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.categoryId} was not found`
          )
        }

        assertBook(category, book.id)
        if (!isManagedCategoryAccount(category)) {
          throw new ApplicationError(
            "CATEGORY_ACCOUNT_REQUIRED",
            "Operation requires a managed category"
          )
        }
        assertExpectedVersion(category, command.expectedVersion)

        if (
          await repositories.accounts.existsWithName(
            book.id,
            category.kind,
            normalizeAccountName(command.name),
            category.id
          )
        ) {
          throw new ApplicationError(
            "DUPLICATE_ENTITY",
            `Category ${command.name} already exists`
          )
        }

        category.updateCategory({
          name: command.name,
          iconKey: command.iconKey,
          colorHex: command.colorHex,
        })
        if (category.version !== command.expectedVersion) {
          await repositories.accounts.save(category, command.expectedVersion)
        }

        return toCategoryDto(category)
      },
    })
  }
}

function assertBook(
  category: LedgerAccount,
  bookId: LedgerAccount["bookId"]
): void {
  if (category.bookId !== bookId) {
    throw new ApplicationError(
      "BOOK_MISMATCH",
      "Category does not belong to the requested book"
    )
  }
}

function assertExpectedVersion(
  category: LedgerAccount,
  expectedVersion: number
): void {
  if (category.version !== expectedVersion) {
    throw new ApplicationError(
      "OPTIMISTIC_CONCURRENCY_FAILURE",
      `Ledger account ${category.id} has a conflicting version`
    )
  }
}

function toCategoryDto(category: LedgerAccount): CategoryDto {
  const snapshot = category.toCategorySnapshot()
  return {
    id: snapshot.id,
    bookId: snapshot.bookId,
    name: snapshot.name,
    kind: snapshot.kind === "INCOME" ? "INCOME" : "EXPENSE",
    status: snapshot.status,
    iconKey: snapshot.iconKey,
    colorHex: snapshot.colorHex,
    version: snapshot.version,
  }
}
