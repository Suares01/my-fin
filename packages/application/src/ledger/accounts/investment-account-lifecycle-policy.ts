import type { LedgerAccount } from "@workspace/domain"
import { ApplicationError } from "../../ports/errors.js"
import type { RepositoryContext } from "../../ports/repositories.js"

export class InvestmentAccountLifecyclePolicy {
  async assertCanArchive(
    repositories: RepositoryContext,
    account: LedgerAccount
  ): Promise<void> {
    if (account.status === "ARCHIVED") return

    if (account.financialAccount?.type === "INVESTMENT_ACCOUNT") {
      const [hasOpenPosition, balance] = await Promise.all([
        repositories.investmentPositions.hasOpenForAccount(
          account.bookId,
          account.id
        ),
        repositories.investmentReads.accountLedgerBalance(
          account.bookId,
          account.id
        ),
      ])
      if (hasOpenPosition || BigInt(balance) !== 0n) {
        throw new ApplicationError(
          "INVESTMENT_ACCOUNT_IN_USE",
          "Investment account has an open position or non-zero balance"
        )
      }
    }

    if (
      await repositories.investmentReads.hasActiveSettlementDependents(
        account.bookId,
        account.id
      )
    ) {
      throw new ApplicationError(
        "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED",
        "Active investment accounts depend on this settlement account"
      )
    }
  }

  async assertCanReactivate(
    repositories: RepositoryContext,
    account: LedgerAccount
  ): Promise<void> {
    if (
      account.status === "ACTIVE" ||
      account.financialAccount?.type !== "INVESTMENT_ACCOUNT"
    ) {
      return
    }

    const settlementId =
      account.financialAccount.investment?.defaultSettlementAccountId
    if (settlementId === undefined) return
    if (settlementId === account.id) throw invalidSettlementAccount()

    const settlement = await repositories.accounts.findById(settlementId)
    if (
      settlement === null ||
      settlement.bookId !== account.bookId ||
      settlement.status !== "ACTIVE" ||
      (settlement.financialAccount?.type !== "BANK_ACCOUNT" &&
        settlement.financialAccount?.type !== "PAYMENT_ACCOUNT")
    ) {
      throw invalidSettlementAccount()
    }
  }
}

function invalidSettlementAccount(): ApplicationError {
  return new ApplicationError(
    "INVALID_SETTLEMENT_ACCOUNT",
    "Settlement account must be an active bank or payment account in the same book"
  )
}
