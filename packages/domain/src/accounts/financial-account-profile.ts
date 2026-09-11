import type { LedgerAccountId } from "../shared/identity/ids.js"
import { DomainError } from "../shared/kernel/domain-error.js"
import type {
  LedgerAccountKind,
  SystemAccountPurpose,
} from "../ledger/accounts/ledger-account.js"

export const FINANCIAL_ACCOUNT_TYPES = [
  "BANK_ACCOUNT",
  "PAYMENT_ACCOUNT",
  "INVESTMENT_ACCOUNT",
  "CASH",
  "OTHER_ASSET",
  "CREDIT_CARD",
  "OTHER_LIABILITY",
] as const

export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number]

export interface InvestmentAccountProfileSnapshot {
  readonly defaultSettlementAccountId?: LedgerAccountId
}

export interface FinancialAccountProfileSnapshot {
  readonly type: FinancialAccountType
  readonly institutionName?: string
  readonly displayReference?: string
  readonly investment?: InvestmentAccountProfileSnapshot
}

export class FinancialAccountProfile {
  private constructor(
    private readonly profile: FinancialAccountProfileSnapshot
  ) {}

  static create(
    input: FinancialAccountProfileSnapshot
  ): FinancialAccountProfile {
    const institutionName = optionalText(input.institutionName)
    const displayReference = optionalText(input.displayReference)

    if (input.type !== "INVESTMENT_ACCOUNT" && input.investment !== undefined) {
      throw invalidProfile()
    }

    return new FinancialAccountProfile({
      type: input.type,
      ...(institutionName === undefined ? {} : { institutionName }),
      ...(displayReference === undefined ? {} : { displayReference }),
      ...(input.type !== "INVESTMENT_ACCOUNT"
        ? {}
        : {
            investment:
              input.investment === undefined
                ? {}
                : {
                    ...(input.investment.defaultSettlementAccountId ===
                    undefined
                      ? {}
                      : {
                          defaultSettlementAccountId:
                            input.investment.defaultSettlementAccountId,
                        }),
                  },
          }),
    })
  }

  get type(): FinancialAccountType {
    return this.profile.type
  }

  get kind(): LedgerAccountKind {
    return ledgerAccountKindForFinancialType(this.type)
  }

  toSnapshot(): FinancialAccountProfileSnapshot {
    return {
      ...this.profile,
      ...(this.profile.investment === undefined
        ? {}
        : { investment: { ...this.profile.investment } }),
    }
  }
}

export function ledgerAccountKindForFinancialType(
  type: FinancialAccountType
): LedgerAccountKind {
  return type === "CREDIT_CARD" || type === "OTHER_LIABILITY"
    ? "LIABILITY"
    : "ASSET"
}

export function assertFinancialAccountProfileAllowed(input: {
  readonly profile: FinancialAccountProfile
  readonly kind: LedgerAccountKind
  readonly systemPurpose?: SystemAccountPurpose
}): void {
  if (
    input.systemPurpose !== undefined ||
    (input.kind !== "ASSET" && input.kind !== "LIABILITY") ||
    input.profile.kind !== input.kind
  ) {
    throw invalidProfile()
  }
}

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  if (trimmed.length > 120) {
    throw invalidProfile()
  }
  return trimmed
}

function invalidProfile(): DomainError {
  return new DomainError(
    "INVALID_FINANCIAL_ACCOUNT_PROFILE",
    "Financial account profile is structurally invalid"
  )
}
