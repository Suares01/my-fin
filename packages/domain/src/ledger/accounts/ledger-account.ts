import type { BookId, LedgerAccountId } from "../../shared/identity/ids.js"
import { AggregateRoot } from "../../shared/kernel/aggregate-root.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import {
  assertFinancialAccountProfileAllowed,
  FinancialAccountProfile,
  type FinancialAccountProfileSnapshot,
} from "../../accounts/financial-account-profile.js"
import {
  categoryAppearance,
  type CategoryAppearance,
} from "./category-appearance.js"

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
  readonly iconKey?: string
  readonly colorHex?: string
  readonly financialAccount?: FinancialAccountProfileSnapshot
  readonly version: number
}

export interface CreateLedgerAccountInput {
  readonly id: LedgerAccountId
  readonly bookId: BookId
  readonly name: string
  readonly kind: LedgerAccountKind
  readonly systemPurpose?: SystemAccountPurpose
  readonly iconKey?: string
  readonly colorHex?: string
  readonly financialAccount?: FinancialAccountProfileSnapshot
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

export function isManagedCategoryAccount(account: LedgerAccount): boolean {
  return isCategoryAccount(account) && account.systemPurpose === undefined
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
    private accountIconKey: string | undefined,
    private accountColorHex: string | undefined,
    private accountFinancialProfile:
      | FinancialAccountProfileSnapshot
      | undefined,
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

    const appearance = validateAppearance(input)
    const financialProfile = createFinancialProfile(input)

    const account = new LedgerAccount(
      input.id,
      input.bookId,
      name,
      normalizeAccountName(input.name),
      input.kind,
      "ACTIVE",
      input.systemPurpose,
      appearance?.iconKey,
      appearance?.colorHex,
      financialProfile,
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
    const appearance = validateAppearance(snapshot)
    const financialProfile = restoreFinancialProfile(snapshot)

    return new LedgerAccount(
      snapshot.id,
      snapshot.bookId,
      snapshot.name,
      snapshot.normalizedName,
      snapshot.kind,
      snapshot.status,
      snapshot.systemPurpose,
      appearance?.iconKey,
      appearance?.colorHex,
      financialProfile,
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

  get iconKey(): string | undefined {
    return this.accountIconKey
  }

  get colorHex(): string | undefined {
    return this.accountColorHex
  }

  get version(): number {
    return this.accountVersion
  }

  get financialAccount(): FinancialAccountProfileSnapshot | undefined {
    return cloneFinancialProfile(this.accountFinancialProfile)
  }

  configureFinancialProfile(profile: FinancialAccountProfileSnapshot): void {
    const next = FinancialAccountProfile.create(profile)
    assertFinancialAccountProfileAllowed({
      profile: next,
      kind: this.kind,
      ...(this.systemPurpose === undefined
        ? {}
        : { systemPurpose: this.systemPurpose }),
    })
    const nextSnapshot = next.toSnapshot()
    if (sameFinancialProfile(this.accountFinancialProfile, nextSnapshot)) {
      return
    }

    const previous = this.accountFinancialProfile
    this.accountFinancialProfile = cloneFinancialProfile(nextSnapshot)
    this.accountVersion += 1
    this.recordFact({
      type: isSettlementOnlyChange(previous, nextSnapshot)
        ? "InvestmentSettlementAccountChanged"
        : "FinancialAccountConfigured",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.lifecyclePayload(),
    })
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

  updateCategory(input: {
    readonly name: string
    readonly iconKey: string
    readonly colorHex: string
  }): void {
    this.assertManagedCategory()

    const trimmedName = input.name.trim()
    if (trimmedName.length === 0) {
      throw new DomainError(
        "INVALID_ACCOUNT_NAME",
        "Account name cannot be empty"
      )
    }
    const appearance = categoryAppearance(input)

    if (
      trimmedName === this.name &&
      appearance.iconKey === this.iconKey &&
      appearance.colorHex === this.colorHex
    ) {
      return
    }

    this.accountName = trimmedName
    this.accountNormalizedName = normalizeAccountName(trimmedName)
    this.accountIconKey = appearance.iconKey
    this.accountColorHex = appearance.colorHex
    this.accountVersion += 1
    this.recordFact({
      type: "CategoryUpdated",
      aggregateId: this.id,
      aggregateVersion: this.version,
      payload: this.categoryPayload(),
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
      ...(this.iconKey === undefined ? {} : { iconKey: this.iconKey }),
      ...(this.colorHex === undefined ? {} : { colorHex: this.colorHex }),
      ...(this.financialAccount === undefined
        ? {}
        : { financialAccount: this.financialAccount }),
      version: this.version,
    }
  }

  toCategorySnapshot(): LedgerAccountSnapshot & {
    readonly iconKey: string
    readonly colorHex: string
  } {
    this.assertManagedCategory()
    if (this.iconKey === undefined || this.colorHex === undefined) {
      throw new DomainError(
        "CATEGORY_APPEARANCE_REQUIRED",
        "Managed categories require visual metadata"
      )
    }

    return {
      ...this.toSnapshot(),
      iconKey: this.iconKey,
      colorHex: this.colorHex,
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

  private assertManagedCategory(): void {
    if (!isManagedCategoryAccount(this)) {
      throw new DomainError(
        "CATEGORY_ACCOUNT_REQUIRED",
        "Operation requires a managed category"
      )
    }
  }

  private lifecyclePayload() {
    return this.categoryPayload()
  }

  private categoryPayload() {
    return {
      bookId: this.bookId,
      kind: this.kind,
      name: this.name,
      normalizedName: this.normalizedName,
      status: this.status,
      ...(this.iconKey === undefined ? {} : { iconKey: this.iconKey }),
      ...(this.colorHex === undefined ? {} : { colorHex: this.colorHex }),
      ...(this.financialAccount === undefined
        ? {}
        : { financialAccount: this.financialAccount }),
    }
  }
}

function createFinancialProfile(
  input: CreateLedgerAccountInput
): FinancialAccountProfileSnapshot | undefined {
  if (input.financialAccount === undefined) {
    if (input.kind !== "ASSET" && input.kind !== "LIABILITY") {
      return undefined
    }
    return FinancialAccountProfile.create({
      type: input.kind === "ASSET" ? "OTHER_ASSET" : "OTHER_LIABILITY",
    }).toSnapshot()
  }

  const profile = FinancialAccountProfile.create(input.financialAccount)
  assertFinancialAccountProfileAllowed({
    profile,
    kind: input.kind,
    ...(input.systemPurpose === undefined
      ? {}
      : { systemPurpose: input.systemPurpose }),
  })
  return profile.toSnapshot()
}

function restoreFinancialProfile(
  snapshot: LedgerAccountSnapshot
): FinancialAccountProfileSnapshot | undefined {
  if (snapshot.financialAccount === undefined) {
    return undefined
  }

  const profile = FinancialAccountProfile.create(snapshot.financialAccount)
  assertFinancialAccountProfileAllowed({
    profile,
    kind: snapshot.kind,
    ...(snapshot.systemPurpose === undefined
      ? {}
      : { systemPurpose: snapshot.systemPurpose }),
  })
  return profile.toSnapshot()
}

function cloneFinancialProfile(
  profile: FinancialAccountProfileSnapshot | undefined
): FinancialAccountProfileSnapshot | undefined {
  if (profile === undefined) {
    return undefined
  }
  return {
    ...profile,
    ...(profile.investment === undefined
      ? {}
      : { investment: { ...profile.investment } }),
  }
}

function sameFinancialProfile(
  left: FinancialAccountProfileSnapshot | undefined,
  right: FinancialAccountProfileSnapshot
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isSettlementOnlyChange(
  previous: FinancialAccountProfileSnapshot | undefined,
  next: FinancialAccountProfileSnapshot
): boolean {
  return (
    previous?.type === "INVESTMENT_ACCOUNT" &&
    next.type === "INVESTMENT_ACCOUNT" &&
    previous.institutionName === next.institutionName &&
    previous.displayReference === next.displayReference
  )
}

function validateAppearance(
  input: Pick<
    CreateLedgerAccountInput | LedgerAccountSnapshot,
    "kind" | "systemPurpose" | "iconKey" | "colorHex"
  >
): CategoryAppearance | undefined {
  const hasIcon = input.iconKey !== undefined
  const hasColor = input.colorHex !== undefined
  const hasAppearance = hasIcon || hasColor
  const isManagedCategory =
    (input.kind === "INCOME" || input.kind === "EXPENSE") &&
    input.systemPurpose === undefined

  if (!isManagedCategory) {
    if (hasAppearance) {
      throw new DomainError(
        "CATEGORY_APPEARANCE_FORBIDDEN",
        "Only managed categories can have visual metadata"
      )
    }
    return undefined
  }

  if (!hasIcon || !hasColor) {
    throw new DomainError(
      "CATEGORY_APPEARANCE_REQUIRED",
      "Managed categories require visual metadata"
    )
  }

  return categoryAppearance({
    iconKey: input.iconKey,
    colorHex: input.colorHex,
  })
}
