import {
  bookIdFromString,
  Currency,
  FinancialBook,
  LedgerAccount,
} from "@workspace/domain"
import type {
  BookDto,
  CreateFinancialBookCommand,
  IdGenerator,
  TransactionManager,
} from "../ports/index.js"
import { DomainEventDispatcher } from "../core/event-dispatcher.js"
import { executeUseCase } from "../core/use-case-executor.js"

const SYSTEM_ACCOUNTS = [
  { purpose: "OPENING_BALANCE", kind: "EQUITY", name: "Opening balance" },
  {
    purpose: "RECONCILIATION_ADJUSTMENT",
    kind: "EQUITY",
    name: "Reconciliation adjustment",
  },
  {
    purpose: "UNCATEGORIZED_INCOME",
    kind: "INCOME",
    name: "Uncategorized income",
  },
  {
    purpose: "UNCATEGORIZED_EXPENSE",
    kind: "EXPENSE",
    name: "Uncategorized expense",
  },
] as const

export class CreateFinancialBook {
  private readonly eventDispatcher: DomainEventDispatcher

  constructor(
    private readonly transactionManager: TransactionManager,
    eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator
  ) {
    this.eventDispatcher = eventDispatcher
  }

  async execute(
    command: CreateFinancialBookCommand
  ): Promise<
    import("@workspace/domain").Result<
      BookDto,
      import("../ports/errors.js").ApplicationError
    >
  > {
    return executeUseCase({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const book = FinancialBook.create({
          id: bookIdFromString(this.ids.nextBookId()),
          name: command.name,
          baseCurrency: Currency.parse(command.baseCurrency),
          timezone: command.timezone,
        })

        await repositories.books.add(book)

        for (const systemAccount of SYSTEM_ACCOUNTS) {
          await repositories.accounts.add(
            LedgerAccount.create({
              id: this.ids.nextLedgerAccountId(),
              bookId: book.id,
              name: systemAccount.name,
              kind: systemAccount.kind,
              systemPurpose: systemAccount.purpose,
            })
          )
        }

        return toBookDto(book)
      },
    })
  }
}

function toBookDto(book: FinancialBook): BookDto {
  return {
    id: book.id,
    name: book.name,
    baseCurrency: book.baseCurrency.code,
    timezone: book.timezone,
    version: book.version,
  }
}
