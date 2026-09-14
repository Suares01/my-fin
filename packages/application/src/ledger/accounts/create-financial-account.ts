import {
  bookIdFromString,
  FinancialAccountProfile,
  FINANCIAL_ACCOUNT_TYPES,
  LedgerAccount,
  ledgerAccountIdFromString,
  normalizeAccountName,
} from "@workspace/domain"
import type { FinancialAccountType } from "@workspace/domain"
import type {
  AccountDto,
  CreateFinancialAccountCommand,
  IdGenerator,
  TransactionManager,
} from "../../ports/index.js"
import { ApplicationError } from "../../ports/errors.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"
import { executeUseCase } from "../../core/use-case-executor.js"

export class CreateFinancialAccount {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator
  ) {}

  async execute(command: CreateFinancialAccountCommand) {
    return executeUseCase({
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      work: async (repositories) => {
        const bookId = bookIdFromString(command.bookId)
        const book = await repositories.books.findById(bookId)
        if (book === null) {
          throw new ApplicationError(
            "ENTITY_NOT_FOUND",
            `Financial book ${command.bookId} was not found`
          )
        }

        if (!isFinancialAccountType(command.type)) {
          throw new ApplicationError(
            "INVALID_ACCOUNT_KIND",
            "Financial account type is invalid"
          )
        }

        const profile = FinancialAccountProfile.create({
          type: command.type,
          ...(command.institutionName === undefined
            ? {}
            : { institutionName: command.institutionName }),
          ...(command.displayReference === undefined
            ? {}
            : { displayReference: command.displayReference }),
          ...(command.defaultSettlementAccountId === undefined
            ? {}
            : {
                investment: {
                  defaultSettlementAccountId: ledgerAccountIdFromString(
                    command.defaultSettlementAccountId
                  ),
                },
              }),
        })

        const normalizedName = normalizeAccountName(command.name)
        if (
          await repositories.accounts.existsWithName(
            book.id,
            profile.kind,
            normalizedName
          )
        ) {
          throw new ApplicationError(
            "DUPLICATE_ENTITY",
            `Financial account ${command.name} already exists`
          )
        }

        const account = LedgerAccount.create({
          id: this.ids.nextLedgerAccountId(),
          bookId: book.id,
          name: command.name,
          kind: profile.kind,
          financialAccount: profile.toSnapshot(),
        })
        await repositories.accounts.add(account)
        return toAccountDto(account)
      },
    })
  }
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

function isFinancialAccountType(value: string): value is FinancialAccountType {
  return (FINANCIAL_ACCOUNT_TYPES as readonly string[]).includes(value)
}
