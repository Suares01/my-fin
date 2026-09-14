import {
  bookIdFromString,
  Currency,
  JournalEntryFactory,
  journalEntryIdFromString,
  LocalDate,
  Money,
} from "@workspace/domain"
import type {
  Clock,
  IdGenerator,
  SetOpeningBalanceCommand,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import type { RepositoryContext } from "../../ports/repositories.js"

export class SetOpeningBalance {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: SetOpeningBalanceCommand) {
    return executeUseCase({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: (repositories) =>
        setOpeningBalanceInTransaction(
          repositories,
          command,
          this.ids,
          this.clock
        ),
    })
  }
}

export async function setOpeningBalanceInTransaction(
  repositories: RepositoryContext,
  command: SetOpeningBalanceCommand,
  ids: IdGenerator,
  clock: Clock
) {
  const bookId = bookIdFromString(command.bookId)
  const book = await repositories.books.findById(bookId)
  if (book === null) {
    throw new ApplicationError(
      "ENTITY_NOT_FOUND",
      `Financial book ${command.bookId} was not found`
    )
  }

  const account = await repositories.accounts.findById(
    command.accountId as never
  )
  if (account === null) {
    throw new ApplicationError(
      "ENTITY_NOT_FOUND",
      `Ledger account ${command.accountId} was not found`
    )
  }

  const openingBalanceAccount = await repositories.accounts.findBySystemPurpose(
    book.id,
    "OPENING_BALANCE"
  )
  if (openingBalanceAccount === null) {
    throw new ApplicationError(
      "ENTITY_NOT_FOUND",
      "Opening balance system account was not found"
    )
  }

  const activeOpeningBalance =
    await repositories.journalEntries.findActiveOpeningBalanceByAccount(
      book.id,
      account.id
    )
  if (activeOpeningBalance !== null) {
    throw new ApplicationError(
      "OPENING_BALANCE_ALREADY_SET",
      `An active opening balance already exists for account ${account.id}`
    )
  }

  const entry = JournalEntryFactory.setOpeningBalance({
    id: journalEntryIdFromString(ids.nextJournalEntryId()),
    book,
    account,
    openingBalanceAccount,
    occurredOn: LocalDate.parse(command.occurredOn),
    recordedAt: clock.now(),
    sequence: await repositories.journalEntries.reserveNextSequence(book.id),
    description: command.description,
    amount: Money.of(
      BigInt(command.amountMinor),
      Currency.parse(command.currency)
    ),
    accountPostingId: ids.nextPostingId(),
    openingBalancePostingId: ids.nextPostingId(),
  })
  await repositories.journalEntries.add(entry)

  return {
    id: entry.id,
    bookId: entry.bookId,
    occurredOn: entry.occurredOn.value,
    description: entry.description,
    currency: entry.currency.code,
    version: entry.version,
  }
}
