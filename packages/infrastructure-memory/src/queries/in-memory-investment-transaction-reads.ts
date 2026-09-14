import type {
  InvestmentCashState,
  InvestmentTransactionReads,
} from "@workspace/application"
import type { LedgerAccountId } from "@workspace/domain"
import { InMemoryStore } from "../store/in-memory-store.js"

export class InMemoryInvestmentTransactionReads implements InvestmentTransactionReads {
  public constructor(private readonly store: InMemoryStore) {}

  async hasActiveSettlementDependents(
    bookId: string,
    accountId: LedgerAccountId
  ): Promise<boolean> {
    return this.store
      .listAccounts()
      .some(
        (account) =>
          account.bookId === bookId &&
          account.status === "ACTIVE" &&
          account.financialAccount?.type === "INVESTMENT_ACCOUNT" &&
          account.financialAccount.investment?.defaultSettlementAccountId ===
            accountId
      )
  }

  async accountLedgerBalance(
    bookId: string,
    accountId: LedgerAccountId,
    asOf?: string
  ): Promise<string> {
    return this.store
      .listJournalEntries()
      .filter(
        (entry) =>
          entry.bookId === bookId &&
          (asOf === undefined || entry.occurredOn <= asOf)
      )
      .flatMap((entry) => entry.postings)
      .filter((posting) => posting.accountId === accountId)
      .reduce((total, posting) => total + posting.amountMinor, 0n)
      .toString()
  }

  async accountCash(
    bookId: string,
    accountIds: readonly LedgerAccountId[],
    asOf: string
  ): Promise<readonly InvestmentCashState[]> {
    const currency = this.store.getBook(bookId as never)?.baseCurrency ?? ""
    return Promise.all(
      accountIds.map(async (investmentAccountId) => {
        const ledgerMinor = await this.accountLedgerBalance(
          bookId,
          investmentAccountId,
          asOf
        )
        const costMinor = this.store
          .listInvestmentPositions()
          .filter(
            (position) =>
              position.bookId === bookId &&
              position.investmentAccountId === investmentAccountId
          )
          .reduce(
            (total, position) => total + BigInt(position.bookCostMinor),
            0n
          )
        return {
          investmentAccountId,
          cashMinor: (BigInt(ledgerMinor) - costMinor).toString(),
          currency,
        }
      })
    )
  }
}
