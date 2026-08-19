import {
  normalBalanceOf,
  type BookId,
  type LedgerAccountId,
  type LocalDate,
} from "@workspace/domain"
import type { AccountBalanceView, LedgerQueries } from "@workspace/application"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryLedgerQueries implements LedgerQueries {
  constructor(private readonly store: InMemoryStore) {}

  async getAccountBalance(input: {
    bookId: BookId
    accountId: LedgerAccountId
    asOf?: LocalDate
  }): Promise<AccountBalanceView> {
    const account = this.store.getAccount(input.accountId)
    if (account === undefined) {
      throw new Error(`Ledger account ${input.accountId} was not found`)
    }

    const entries = this.entriesForAccount(
      input.bookId,
      input.accountId
    ).filter(
      (entry) =>
        input.asOf === undefined || entry.occurredOn <= input.asOf.value
    )
    const rawBalance = entries.reduce(
      (balance, entry) => balance + entry.amountMinor,
      0n
    )

    return {
      accountId: account.id,
      accountName: account.name,
      accountKind: account.kind,
      rawBalanceMinor: rawBalance.toString(),
      displayBalanceMinor: toDisplayedAmount(rawBalance, account.kind),
      asOf: input.asOf?.value ?? null,
      amountMinor: toDisplayedAmount(rawBalance, account.kind),
      currency: this.currencyForBook(input.bookId, entries[0]?.currency),
    }
  }

  private entriesForAccount(
    bookId: BookId,
    accountId: LedgerAccountId
  ): AccountPosting[] {
    return this.store
      .listJournalEntries()
      .filter((entry) => entry.bookId === bookId)
      .flatMap((entry) =>
        entry.postings
          .filter((posting) => posting.accountId === accountId)
          .map((posting) => ({
            journalEntryId: entry.id,
            occurredOn: entry.occurredOn,
            recordedAt: entry.recordedAt,
            sequence: entry.sequence,
            description: entry.description,
            amountMinor: posting.amountMinor,
            currency: posting.currency,
          }))
      )
  }

  private currencyForBook(
    bookId: BookId,
    fallback: string | undefined
  ): string {
    return this.store.getBook(bookId)?.baseCurrency ?? fallback ?? ""
  }
}

interface AccountPosting {
  readonly journalEntryId: string
  readonly occurredOn: string
  readonly recordedAt: string
  readonly sequence: string
  readonly description: string
  readonly amountMinor: bigint
  readonly currency: string
}

function toDisplayedAmount(
  amountMinor: bigint,
  kind: Parameters<typeof normalBalanceOf>[0]
): string {
  return (
    normalBalanceOf(kind) === "DEBIT" ? amountMinor : -amountMinor
  ).toString()
}
