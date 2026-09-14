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
  TransactionManager,
  TransferMoneyCommand,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import {
  investmentCashWarnings,
  withInvestmentCashWarnings,
} from "./investment-cash-warnings.js"

export class TransferMoney {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: TransferMoneyCommand) {
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

        const originAccount = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.sourceAccountId)
        )
        if (originAccount === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.sourceAccountId} was not found`
          )
        }

        const destinationAccount = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.destinationAccountId)
        )
        if (destinationAccount === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.destinationAccountId} was not found`
          )
        }

        const entry = JournalEntryFactory.transfer({
          id: journalEntryIdFromString(this.ids.nextJournalEntryId()),
          book,
          originAccount,
          destinationAccount,
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
          originPostingId: this.ids.nextPostingId(),
          destinationPostingId: this.ids.nextPostingId(),
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
