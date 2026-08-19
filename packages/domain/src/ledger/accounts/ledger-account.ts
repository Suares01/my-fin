import type { BookId, LedgerAccountId } from "../../shared/identity/ids.js"
import { AggregateRoot } from "../../shared/kernel/aggregate-root.js"
import { DomainError } from "../../shared/kernel/domain-error.js"

export const LEDGER_ACCOUNT_KINDS = [
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "EQUITY",
] as const

export type LedgerAccountKind = (typeof LEDGER_ACCOUNT_KINDS)[number]
export type LedgerAccountStatus = "ACTIVE" | "ARCHIVED"
export type SystemAccountPurpose =
  | "OPENING_BALANCE"
  | "RECONCILIATION_ADJUSTMENT"
  | "UNCATEGORIZED_INCOME"
  | "UNCATEGORIZED_EXPENSE"

export interface LedgerAccountSnapshot {
  readonly id: LedgerAccountId
  readonly bookId: BookId
  readonly name: string
  readonly normalizedName: string
  readonly kind: LedgerAccountKind
  readonly status: LedgerAccountStatus
  readonly systemPurpose?: SystemAccountPurpose
  readonly version: number
}

export interface CreateLedgerAccountInput {
  readonly id: LedgerAccountId
  readonly bookId: BookId
  readonly name: string
  readonly kind: LedgerAccountKind
  readonly systemPurpose?: SystemAccountPurpose
}

export function normalizeAccountName(name: string): string {
  return name.trim().normalize("NFC").toLowerCase()
}

export function normalBalanceOf(kind: LedgerAccountKind): "DEBIT" | "CREDIT" {
  return kind === "ASSET" || kind === "EXPENSE" ? "DEBIT" : "CREDIT"
}

export function isFinancialAccount(account: LedgerAccount): boolean {
  return account.kind === "ASSET" || account.kind === "LIABILITY"
}

export function isCategoryAccount(account: LedgerAccount): boolean {
  return account.kind === "INCOME" || account.kind === "EXPENSE"
}

export class LedgerAccount extends AggregateRoot<
  LedgerAccountId,
  LedgerAccountSnapshot
> {
  private constructor(
    id: LedgerAccountId,
    private readonly accountBookId: BookId,
    private accountName: string,
    private accountNormalizedName: string,
    private readonly accountKind: LedgerAccountKind,
    private accountStatus: LedgerAccountStatus,
    private readonly accountSystemPurpose: SystemAccountPurpose | undefined,
    private accountVersion: number
  ) {
    super(id)
  }

  static create(input: CreateLedgerAccountInput): LedgerAccount {
    const name = input.name.trim()
    if (name.length === 0) {
      throw new DomainError(
        "INVALID_ACCOUNT_NAME",
        "Account name cannot be empty"
      )
    }

    const account = new LedgerAccount(
      input.id,
      input.bookId,
      name,
      normalizeAccountName(input.name),
      input.kind,
      "ACTIVE",
      input.systemPurpose,
      0
    )
    account.recordFact({
      type: "LedgerAccountCreated",
      aggregateId: input.id,
      aggregateVersion: account.version,
      payload: account.toSnapshot(),
    })
    return account
  }

  static restore(snapshot: LedgerAccountSnapshot): LedgerAccount {
    return new LedgerAccount(
      snapshot.id,
      snapshot.bookId,
      snapshot.name,
      snapshot.normalizedName,
      snapshot.kind,
      snapshot.status,
      snapshot.systemPurpose,
      snapshot.version
    )
  }

  get bookId(): BookId {
    return this.accountBookId
  }

  get name(): string {
    return this.accountName
  }

  get normalizedName(): string {
    return this.accountNormalizedName
  }

  get kind(): LedgerAccountKind {
    return this.accountKind
  }

  get status(): LedgerAccountStatus {
    return this.accountStatus
  }

  get systemPurpose(): SystemAccountPurpose | undefined {
    return this.accountSystemPurpose
  }

  get version(): number {
    return this.accountVersion
  }

  get normalBalance(): "DEBIT" | "CREDIT" {
    return normalBalanceOf(this.kind)
  }

  archive(): void {
    this.assertNotSystemAccount()
    if (this.status === "ARCHIVED") {
      return
    }

    this.accountStatus = "ARCHIVED"
    this.accountVersion += 1
    this.recordFact({
      type: "LedgerAccountArchived",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.lifecyclePayload(),
    })
  }

  rename(name: string): void {
    this.assertNotSystemAccount()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      throw new DomainError(
        "INVALID_ACCOUNT_NAME",
        "Account name cannot be empty"
      )
    }

    if (trimmedName === this.name) {
      return
    }

    this.accountName = trimmedName
    this.accountNormalizedName = normalizeAccountName(trimmedName)
    this.accountVersion += 1
    this.recordFact({
      type: "LedgerAccountRenamed",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.lifecyclePayload(),
    })
  }

  reactivate(): void {
    this.assertNotSystemAccount()
    if (this.status === "ACTIVE") {
      return
    }

    this.accountStatus = "ACTIVE"
    this.accountVersion += 1
    this.recordFact({
      type: "LedgerAccountReactivated",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.lifecyclePayload(),
    })
  }

  toSnapshot(): LedgerAccountSnapshot {
    return {
      id: this.id,
      bookId: this.bookId,
      name: this.name,
      normalizedName: this.normalizedName,
      kind: this.kind,
      status: this.status,
      ...(this.systemPurpose === undefined
        ? {}
        : { systemPurpose: this.systemPurpose }),
      version: this.version,
    }
  }

  private assertNotSystemAccount(): void {
    if (this.systemPurpose !== undefined) {
      throw new DomainError(
        "SYSTEM_ACCOUNT_PROTECTED",
        "System accounts cannot be changed"
      )
    }
  }

  private lifecyclePayload() {
    return {
      bookId: this.bookId,
      kind: this.kind,
      name: this.name,
      normalizedName: this.normalizedName,
      status: this.status,
    }
  }
}
