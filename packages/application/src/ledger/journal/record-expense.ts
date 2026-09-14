import {
  bookIdFromString,
  Currency,
  JournalEntryFactory,
  journalEntryIdFromString,
  ledgerAccountIdFromString,
  LocalDate,
  Money,
} from "@workspace/domain"
import type {
  Clock,
  IdGenerator,
  JournalEntryCommand,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import {
  investmentCashWarnings,
  withInvestmentCashWarnings,
} from "./investment-cash-warnings.js"

export class RecordExpense {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: JournalEntryCommand) {
    return executeUseCase({
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

        const financialAccount = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.accountId)
        )
        if (financialAccount === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.accountId} was not found`
          )
        }

        const expenseCategory = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.categoryId)
        )
        if (expenseCategory === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.categoryId} was not found`
          )
        }

        const entry = JournalEntryFactory.recordExpense({
          id: journalEntryIdFromString(this.ids.nextJournalEntryId()),
          book,
          financialAccount,
          expenseCategory,
          occurredOn: LocalDate.parse(command.occurredOn),
          recordedAt: this.clock.now(),
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          description: command.description,
          amount: Money.of(
            BigInt(command.amountMinor),
            Currency.parse(command.currency)
          ),
          financialPostingId: this.ids.nextPostingId(),
          categoryPostingId: this.ids.nextPostingId(),
        })
        await repositories.journalEntries.add(entry)

        return withInvestmentCashWarnings(
          {
            id: entry.id,
            bookId: entry.bookId,
            occurredOn: entry.occurredOn.value,
            description: entry.description,
            currency: entry.currency.code,
            version: entry.version,
          },
          await investmentCashWarnings(
            repositories,
            book.id,
            entry.postings.map((posting) => posting.accountId),
            entry.occurredOn.value
          )
        )
      },
    })
  }
}
