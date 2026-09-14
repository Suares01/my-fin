export interface CreateFinancialBookCommand {
  readonly name: string
  readonly baseCurrency: string
  readonly timezone: string
}

export interface CreateFinancialAccountCommand {
  readonly bookId: string
  readonly name: string
  readonly type: string
  readonly institutionName?: string
  readonly displayReference?: string
  readonly defaultSettlementAccountId?: string
}

export interface ConfigureFinancialAccountCommand {
  readonly bookId: string
  readonly accountId: string
  readonly expectedVersion: number
  readonly profile: {
    readonly type: string
    readonly institutionName?: string
    readonly displayReference?: string
    readonly defaultSettlementAccountId?: string
  }
}

export interface SetInvestmentSettlementAccountCommand {
  readonly bookId: string
  readonly accountId: string
  readonly expectedVersion: number
  readonly settlementAccountId: string
}

export interface ClearInvestmentSettlementAccountCommand {
  readonly bookId: string
  readonly accountId: string
  readonly expectedVersion: number
}

export interface CreateCategoryCommand {
  readonly bookId: string
  readonly name: string
  readonly kind: "INCOME" | "EXPENSE"
  readonly iconKey: string
  readonly colorHex: string
}

export interface UpdateCategoryCommand {
  readonly bookId: string
  readonly categoryId: string
  readonly expectedVersion: number
  readonly name: string
  readonly iconKey: string
  readonly colorHex: string
}

export interface ArchiveCategoryCommand {
  readonly bookId: string
  readonly categoryId: string
  readonly expectedVersion: number
}

export interface ReactivateCategoryCommand {
  readonly bookId: string
  readonly categoryId: string
  readonly expectedVersion: number
}

export interface JournalEntryCommand {
  readonly bookId: string
  readonly accountId: string
  readonly categoryId: string
  readonly amountMinor: string
  readonly currency: string
  readonly occurredOn: string
  readonly description: string
}

export interface TransferMoneyCommand {
  readonly bookId: string
  readonly sourceAccountId: string
  readonly destinationAccountId: string
  readonly amountMinor: string
  readonly currency: string
  readonly occurredOn: string
  readonly description: string
}

export interface SetOpeningBalanceCommand {
  readonly bookId: string
  readonly accountId: string
  readonly amountMinor: string
  readonly currency: string
  readonly occurredOn: string
  readonly description: string
}

export interface ReverseJournalEntryCommand {
  readonly bookId: string
  readonly journalEntryId: string
  readonly expectedVersion: number
  readonly occurredOn: string
  readonly description: string
}

export type JournalBusinessDraft =
  | {
      readonly type: "OPENING_BALANCE"
      readonly accountId: string
      readonly amountMinor: string
      readonly currency: string
      readonly occurredOn: string
      readonly description: string
    }
  | {
      readonly type: "INCOME" | "EXPENSE"
      readonly accountId: string
      readonly categoryId: string
      readonly amountMinor: string
      readonly currency: string
      readonly occurredOn: string
      readonly description: string
    }
  | {
      readonly type: "TRANSFER"
      readonly sourceAccountId: string
      readonly destinationAccountId: string
      readonly amountMinor: string
      readonly currency: string
      readonly occurredOn: string
      readonly description: string
    }

export interface AmendJournalEntryCommand {
  readonly bookId: string
  readonly journalEntryId: string
  readonly expectedVersion: number
  readonly replacement: JournalBusinessDraft
}

export interface RenameLedgerAccountCommand {
  readonly bookId: string
  readonly accountId: string
  readonly expectedVersion: number
  readonly name: string
}

export interface ArchiveLedgerAccountCommand {
  readonly bookId: string
  readonly accountId: string
  readonly expectedVersion: number
}

export interface ReactivateLedgerAccountCommand {
  readonly bookId: string
  readonly accountId: string
  readonly expectedVersion: number
}

export interface AmendJournalEntryResult {
  readonly targetId: string
  readonly reversalId: string
  readonly replacementId: string
  readonly replacementVersion: number
  readonly state: "EFFECTIVE"
}

export interface AccountBalanceQuery {
  readonly bookId: string
  readonly accountId: string
  readonly asOf?: string
}

export interface BookDto {
  readonly id: string
  readonly name: string
  readonly baseCurrency: string
  readonly timezone: string
  readonly version: number
}

export interface AccountDto {
  readonly id: string
  readonly bookId: string
  readonly name: string
  readonly kind: string
  readonly status: string
  readonly version: number
  readonly financialAccount?: {
    readonly type: string
    readonly institutionName?: string
    readonly displayReference?: string
    readonly investment?: { readonly defaultSettlementAccountId?: string }
  }
}

export interface CategoryDto {
  readonly id: string
  readonly bookId: string
  readonly name: string
  readonly kind: "INCOME" | "EXPENSE"
  readonly status: "ACTIVE" | "ARCHIVED"
  readonly iconKey: string
  readonly colorHex: string
  readonly version: number
}

export interface JournalEntryDto {
  readonly id: string
  readonly bookId: string
  readonly occurredOn: string
  readonly description: string
  readonly currency: string
  readonly version: number
}
