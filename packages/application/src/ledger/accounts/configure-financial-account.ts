import {
  bookIdFromString,
  FinancialAccountProfile,
  FINANCIAL_ACCOUNT_TYPES,
  ledgerAccountIdFromString,
  type FinancialAccountProfileSnapshot,
  type FinancialAccountType,
  type LedgerAccount,
} from "@workspace/domain"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"
import type {
  AccountDto,
  ClearInvestmentSettlementAccountCommand,
  ConfigureFinancialAccountCommand,
  SetInvestmentSettlementAccountCommand,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"

export class ConfigureFinancialAccount {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher
  ) {}

  async execute(command: ConfigureFinancialAccountCommand) {
    return this.mutate(command, () => profileFromCommand(command))
  }

  async setInvestmentSettlementAccount(
    command: SetInvestmentSettlementAccountCommand
  ) {
    return this.mutate(command, (account) => {
      const profile = investmentProfile(account)
      return {
        ...profile,
        investment: {
          defaultSettlementAccountId: ledgerAccountIdFromString(
            command.settlementAccountId
          ),
        },
      }
    })
  }

  async clearInvestmentSettlementAccount(
    command: ClearInvestmentSettlementAccountCommand
  ) {
    return this.mutate(command, (account) => {
      const profile = investmentProfile(account)
      return { ...profile, investment: {} }
    })
  }

  private async mutate(
    command: Pick<
      ConfigureFinancialAccountCommand,
      "bookId" | "accountId" | "expectedVersion"
    >,
    nextProfile: (account: LedgerAccount) => FinancialAccountProfileSnapshot
  ) {
    return executeUseCase<AccountDto>({
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

        const account = await repositories.accounts.findById(
          ledgerAccountIdFromString(command.accountId)
        )
        if (account === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Ledger account ${command.accountId} was not found`
          )
        }
        if (account.bookId !== book.id) {
          throw new ApplicationError(
            "BOOK_MISMATCH",
            "Ledger account does not belong to the requested book"
          )
        }
        if (account.version !== command.expectedVersion) {
          throw new ApplicationError(
            "OPTIMISTIC_CONCURRENCY_FAILURE",
            `Ledger account ${account.id} has a conflicting version`
          )
        }

        const profile = FinancialAccountProfile.create(nextProfile(account))
        if (profile.kind !== account.kind) {
          throw typeChangeNotAllowed()
        }
        await assertTypeChangeAllowed(repositories, account, profile)
        await assertSettlementAccount(repositories, book.id, account, profile)

        account.configureFinancialProfile(profile.toSnapshot())
        if (account.version !== command.expectedVersion) {
          await repositories.accounts.save(account, command.expectedVersion)
        }
        return toAccountDto(account)
      },
    })
  }
}

function profileFromCommand(
  command: ConfigureFinancialAccountCommand
): FinancialAccountProfileSnapshot {
  if (!isFinancialAccountType(command.profile.type)) {
    throw new ApplicationError(
      "INVALID_ACCOUNT_KIND",
      "Financial account type is invalid"
    )
  }
  return {
    type: command.profile.type,
    ...(command.profile.institutionName === undefined
      ? {}
      : { institutionName: command.profile.institutionName }),
    ...(command.profile.displayReference === undefined
      ? {}
      : { displayReference: command.profile.displayReference }),
    ...(command.profile.defaultSettlementAccountId === undefined
      ? {}
      : {
          investment: {
            defaultSettlementAccountId: ledgerAccountIdFromString(
              command.profile.defaultSettlementAccountId
            ),
          },
        }),
  }
}

function investmentProfile(
  account: LedgerAccount
): FinancialAccountProfileSnapshot {
  if (account.financialAccount?.type !== "INVESTMENT_ACCOUNT") {
    throw new ApplicationError(
      "INVALID_FINANCIAL_ACCOUNT_PROFILE",
      "Settlement account requires an investment account"
    )
  }
  return account.financialAccount
}

async function assertTypeChangeAllowed(
  repositories: Parameters<Parameters<typeof executeUseCase>[0]["work"]>[0],
  account: LedgerAccount,
  profile: FinancialAccountProfile
): Promise<void> {
  if (
    account.financialAccount?.type === "INVESTMENT_ACCOUNT" &&
    profile.type !== "INVESTMENT_ACCOUNT" &&
    (await repositories.investmentPositions.hasAnyForAccount(
      account.bookId,
      account.id
    ))
  ) {
    throw typeChangeNotAllowed()
  }
  if (
    isSettlementType(account.financialAccount?.type) &&
    !isSettlementType(profile.type) &&
    (await repositories.investmentReads.hasActiveSettlementDependents(
      account.bookId,
      account.id
    ))
  ) {
    throw typeChangeNotAllowed()
  }
}

async function assertSettlementAccount(
  repositories: Parameters<Parameters<typeof executeUseCase>[0]["work"]>[0],
  bookId: string,
  account: LedgerAccount,
  profile: FinancialAccountProfile
): Promise<void> {
  const settlementId =
    profile.toSnapshot().investment?.defaultSettlementAccountId
  if (settlementId === undefined) return
  if (settlementId === account.id) throw invalidSettlementAccount()

  const settlement = await repositories.accounts.findById(settlementId)
  if (
    settlement === null ||
    settlement.bookId !== bookId ||
    settlement.status !== "ACTIVE" ||
    !isSettlementType(settlement.financialAccount?.type)
  ) {
    throw invalidSettlementAccount()
  }
}

function isFinancialAccountType(value: string): value is FinancialAccountType {
  return (FINANCIAL_ACCOUNT_TYPES as readonly string[]).includes(value)
}

function isSettlementType(type: FinancialAccountType | undefined): boolean {
  return type === "BANK_ACCOUNT" || type === "PAYMENT_ACCOUNT"
}

function typeChangeNotAllowed(): ApplicationError {
  return new ApplicationError(
    "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED",
    "Financial account type change is not allowed"
  )
}

function invalidSettlementAccount(): ApplicationError {
  return new ApplicationError(
    "INVALID_SETTLEMENT_ACCOUNT",
    "Settlement account must be an active bank or payment account in the same book"
  )
}

function toAccountDto(account: LedgerAccount): AccountDto {
  return {
    id: account.id,
    bookId: account.bookId,
    name: account.name,
    kind: account.kind,
    status: account.status,
    version: account.version,
    ...(account.financialAccount === undefined
      ? {}
      : { financialAccount: account.financialAccount }),
  }
}
