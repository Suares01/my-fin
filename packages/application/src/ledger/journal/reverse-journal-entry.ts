import {
  bookIdFromString,
  journalEntryIdFromString,
  LocalDate,
} from "@workspace/domain"
import type {
  Clock,
  IdGenerator,
  ReverseJournalEntryCommand,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import { assertJournalNotOwnedByInvestment } from "./investment-journal-ownership.js"
import {
  investmentCashWarnings,
  withInvestmentCashWarnings,
} from "./investment-cash-warnings.js"

export class ReverseJournalEntry {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: ReverseJournalEntryCommand) {
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

        const original = await repositories.journalEntries.findById(
          journalEntryIdFromString(command.journalEntryId)
        )
        if (original === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Journal entry ${command.journalEntryId} was not found`
          )
        }

        if (original.bookId !== book.id) {
          throw new ApplicationError(
            "BOOK_MISMATCH",
            "Journal entry does not belong to the requested book"
          )
        }

        await assertJournalNotOwnedByInvestment(
          repositories,
          book.id,
          original.id
        )

        if (original.version !== command.expectedVersion) {
          throw new ApplicationError(
            "OPTIMISTIC_CONCURRENCY_FAILURE",
            `Journal entry ${command.journalEntryId} has a conflicting version`
          )
        }

        const expectedVersion = command.expectedVersion
        const reversal = original.createReversal({
          id: journalEntryIdFromString(this.ids.nextJournalEntryId()),
          occurredOn: LocalDate.parse(command.occurredOn),
          recordedAt: this.clock.now(),
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          description: command.description,
          postingIds: original.postings.map(() => this.ids.nextPostingId()),
        })
        original.markReversedBy(reversal.id)

        await repositories.journalEntries.add(reversal)
        await repositories.journalEntries.save(original, expectedVersion)

        return withInvestmentCashWarnings(
          {
            id: reversal.id,
            bookId: reversal.bookId,
            occurredOn: reversal.occurredOn.value,
            description: reversal.description,
            currency: reversal.currency.code,
            version: reversal.version,
          },
          await investmentCashWarnings(
            repositories,
            book.id,
            reversal.postings.map((posting) => posting.accountId),
            reversal.occurredOn.value
          )
        )
      },
    })
  }
}
