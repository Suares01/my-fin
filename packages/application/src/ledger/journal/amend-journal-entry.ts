import {
  bookIdFromString,
  Currency,
  JournalEntryFactory,
  journalEntryIdFromString,
  LedgerAccount,
  ledgerAccountIdFromString,
  LocalDate,
  Money,
  type FinancialBook,
} from "@workspace/domain"
import type {
  AmendJournalEntryCommand,
  AmendJournalEntryResult,
  Clock,
  IdGenerator,
  JournalBusinessDraft,
  RepositoryContext,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"

export class AmendJournalEntry {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(command: AmendJournalEntryCommand) {
    return executeUseCase<AmendJournalEntryResult>({
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

        const target = await repositories.journalEntries.findById(
          journalEntryIdFromString(command.journalEntryId)
        )
        if (target === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Journal entry ${command.journalEntryId} was not found`
          )
        }

        if (target.bookId !== book.id) {
          throw new ApplicationError(
            "BOOK_MISMATCH",
            "Journal entry does not belong to the requested book"
          )
        }

        if (target.version !== command.expectedVersion) {
          throw new ApplicationError(
            "OPTIMISTIC_CONCURRENCY_FAILURE",
            `Journal entry ${command.journalEntryId} has a conflicting version`
          )
        }

        if (!target.isEffective()) {
          throw new ApplicationError(
            "JOURNAL_ENTRY_NOT_EFFECTIVE",
            "Only an effective journal entry can be amended"
          )
        }

        const loaded = await loadReplacement(
          repositories,
          book.id,
          command.replacement
        )
        const recordedAt = this.clock.now()
        const reversalId = journalEntryIdFromString(
          this.ids.nextJournalEntryId()
        )
        const replacementId = journalEntryIdFromString(
          this.ids.nextJournalEntryId()
        )
        const reversal = target.createReversal({
          id: reversalId,
          occurredOn: target.occurredOn,
          recordedAt,
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          description: `Reversal of ${target.description}`,
          postingIds: target.postings.map(() => this.ids.nextPostingId()),
        })
        const replacement = createReplacement({
          loaded,
          book,
          id: replacementId,
          replacementOf: target.id,
          recordedAt,
          sequence: await repositories.journalEntries.reserveNextSequence(
            book.id
          ),
          ids: this.ids,
        })

        target.markAmendedBy(reversal.id, replacement.id)
        await repositories.journalEntries.add(reversal)
        await repositories.journalEntries.add(replacement)
        await repositories.journalEntries.save(target, command.expectedVersion)

        return {
          targetId: target.id,
          reversalId: reversal.id,
          replacementId: replacement.id,
          replacementVersion: replacement.version,
          state: "EFFECTIVE",
        }
      },
    })
  }
}

type LoadedReplacement =
  | {
      readonly draft: Extract<JournalBusinessDraft, { type: "OPENING_BALANCE" }>
      readonly account: LedgerAccount
      readonly openingBalanceAccount: LedgerAccount
    }
  | {
      readonly draft: Extract<
        JournalBusinessDraft,
        { type: "INCOME" | "EXPENSE" }
      >
      readonly account: LedgerAccount
      readonly category: LedgerAccount
    }
  | {
      readonly draft: Extract<JournalBusinessDraft, { type: "TRANSFER" }>
      readonly sourceAccount: LedgerAccount
      readonly destinationAccount: LedgerAccount
    }

async function loadReplacement(
  repositories: RepositoryContext,
  bookId: FinancialBook["id"],
  draft: JournalBusinessDraft
): Promise<LoadedReplacement> {
  if (draft.type === "OPENING_BALANCE") {
    const account = await repositories.accounts.findById(
      ledgerAccountIdFromString(draft.accountId)
    )
    const openingBalanceAccount =
      await repositories.accounts.findBySystemPurpose(bookId, "OPENING_BALANCE")
    if (account === null || openingBalanceAccount === null) {
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        "Replacement account was not found"
      )
    }
    return { draft, account, openingBalanceAccount }
  }

  if (draft.type === "TRANSFER") {
    const sourceAccount = await repositories.accounts.findById(
      ledgerAccountIdFromString(draft.sourceAccountId)
    )
    const destinationAccount = await repositories.accounts.findById(
      ledgerAccountIdFromString(draft.destinationAccountId)
    )
    if (sourceAccount === null || destinationAccount === null) {
      throw new ApplicationError(
        "ENTITY_NOT_FOUND",
        "Replacement account was not found"
      )
    }
    return { draft, sourceAccount, destinationAccount }
  }

  const account = await repositories.accounts.findById(
    ledgerAccountIdFromString(draft.accountId)
  )
  const category = await repositories.accounts.findById(
    ledgerAccountIdFromString(draft.categoryId)
  )
  if (account === null || category === null) {
    throw new ApplicationError(
      "ENTITY_NOT_FOUND",
      "Replacement account was not found"
    )
  }
  return { draft, account, category }
}

function createReplacement(input: {
  readonly loaded: LoadedReplacement
  readonly book: FinancialBook
  readonly id: ReturnType<typeof journalEntryIdFromString>
  readonly replacementOf: ReturnType<typeof journalEntryIdFromString>
  readonly recordedAt: string
  readonly sequence: string
  readonly ids: IdGenerator
}) {
  const { draft } = input.loaded
  const common = {
    id: input.id,
    book: input.book,
    occurredOn: LocalDate.parse(draft.occurredOn),
    recordedAt: input.recordedAt,
    sequence: input.sequence,
    description: draft.description,
    amount: Money.of(BigInt(draft.amountMinor), Currency.parse(draft.currency)),
    replacementOf: input.replacementOf,
  }

  switch (draft.type) {
    case "OPENING_BALANCE": {
      const loaded = input.loaded as Extract<
        LoadedReplacement,
        { draft: { type: "OPENING_BALANCE" } }
      >
      return JournalEntryFactory.setOpeningBalance({
        ...common,
        account: loaded.account,
        openingBalanceAccount: loaded.openingBalanceAccount,
        accountPostingId: input.ids.nextPostingId(),
        openingBalancePostingId: input.ids.nextPostingId(),
      })
    }
    case "INCOME": {
      const loaded = input.loaded as Extract<
        LoadedReplacement,
        { draft: { type: "INCOME" | "EXPENSE" } }
      >
      return JournalEntryFactory.recordIncome({
        ...common,
        financialAccount: loaded.account,
        incomeCategory: loaded.category,
        financialPostingId: input.ids.nextPostingId(),
        categoryPostingId: input.ids.nextPostingId(),
      })
    }
    case "EXPENSE": {
      const loaded = input.loaded as Extract<
        LoadedReplacement,
        { draft: { type: "INCOME" | "EXPENSE" } }
      >
      return JournalEntryFactory.recordExpense({
        ...common,
        financialAccount: loaded.account,
        expenseCategory: loaded.category,
        financialPostingId: input.ids.nextPostingId(),
        categoryPostingId: input.ids.nextPostingId(),
      })
    }
    case "TRANSFER": {
      const loaded = input.loaded as Extract<
        LoadedReplacement,
        { draft: { type: "TRANSFER" } }
      >
      return JournalEntryFactory.transfer({
        ...common,
        originAccount: loaded.sourceAccount,
        destinationAccount: loaded.destinationAccount,
        originPostingId: input.ids.nextPostingId(),
        destinationPostingId: input.ids.nextPostingId(),
      })
    }
  }
}
