import {
  LedgerAccount,
  categoryAppearance,
  type LedgerAccountId,
  type LedgerAccountSnapshot,
  type SystemAccountPurpose,
} from "@workspace/domain"
import { readInteger } from "../queries/sqlite-query-values.js"

const ACCOUNT_KINDS = [
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "EQUITY",
] as const
const ACCOUNT_STATUSES = ["ACTIVE", "ARCHIVED"] as const
const SYSTEM_PURPOSES = [
  "OPENING_BALANCE",
  "RECONCILIATION_ADJUSTMENT",
  "UNCATEGORIZED_INCOME",
  "UNCATEGORIZED_EXPENSE",
] as const

export type LedgerAccountRow = {
  readonly id: unknown
  readonly book_id: unknown
  readonly name: unknown
  readonly normalized_name: unknown
  readonly kind: unknown
  readonly status: unknown
  readonly system_purpose: unknown
  readonly version: unknown
  readonly icon_key: unknown
  readonly color_hex: unknown
  readonly financial_type?: unknown
  readonly institution_name?: unknown
  readonly display_reference?: unknown
  readonly default_settlement_account_id?: unknown
}

export type LedgerAccountPersistence = {
  readonly id: string
  readonly book_id: string
  readonly name: string
  readonly normalized_name: string
  readonly kind: LedgerAccountSnapshot["kind"]
  readonly status: LedgerAccountSnapshot["status"]
  readonly system_purpose: SystemAccountPurpose | null
  readonly version: number
  readonly icon_key: string | null
  readonly color_hex: string | null
}

export const LedgerAccountMapper = {
  toDomain(row: LedgerAccountRow): LedgerAccount {
    const kind = readEnum(row.kind, ACCOUNT_KINDS, "kind")
    const systemPurpose =
      row.system_purpose === null
        ? undefined
        : readEnum(row.system_purpose, SYSTEM_PURPOSES, "system_purpose")
    const appearance = readAppearance(row, kind, systemPurpose)
    const snapshot: LedgerAccountSnapshot = {
      id: readNonEmptyString(row.id, "id") as LedgerAccountSnapshot["id"],
      bookId: readNonEmptyString(
        row.book_id,
        "book_id"
      ) as LedgerAccountSnapshot["bookId"],
      name: readNonEmptyString(row.name, "name"),
      normalizedName: readNonEmptyString(
        row.normalized_name,
        "normalized_name"
      ),
      kind,
      status: readEnum(row.status, ACCOUNT_STATUSES, "status"),
      ...(systemPurpose === undefined ? {} : { systemPurpose }),
      ...appearance,
      ...readFinancialProfile(row, kind, systemPurpose),
      version: readVersion(row.version),
    }

    return LedgerAccount.restore(snapshot)
  },

  toPersistence(account: LedgerAccount): LedgerAccountPersistence {
    const snapshot = account.toSnapshot()
    return {
      id: snapshot.id,
      book_id: snapshot.bookId,
      name: snapshot.name,
      normalized_name: snapshot.normalizedName,
      kind: snapshot.kind,
      status: snapshot.status,
      system_purpose: snapshot.systemPurpose ?? null,
      version: snapshot.version,
      icon_key: snapshot.iconKey ?? null,
      color_hex: snapshot.colorHex ?? null,
    }
  },
}

function readFinancialProfile(
  row: LedgerAccountRow,
  kind: LedgerAccountSnapshot["kind"],
  systemPurpose: SystemAccountPurpose | undefined
): Partial<Pick<LedgerAccountSnapshot, "financialAccount">> {
  const financial = row.financial_type
  const financialRequired =
    systemPurpose === undefined && (kind === "ASSET" || kind === "LIABILITY")

  if (financial === null || financial === undefined) {
    if (financialRequired) {
      throw new TypeError("Financial ledger account is missing its profile")
    }
    return {}
  }

  const type = readEnum(
    financial === "BANK" ? "BANK_ACCOUNT" : financial,
    [
      "BANK_ACCOUNT",
      "PAYMENT_ACCOUNT",
      "INVESTMENT_ACCOUNT",
      "CASH",
      "OTHER_ASSET",
      "CREDIT_CARD",
      "OTHER_LIABILITY",
    ] as const,
    "financial_type"
  )
  const optional = (value: unknown, field: string): string | undefined => {
    if (value === null || value === undefined) {
      return undefined
    }
    return readNonEmptyString(value, field)
  }
  const settlementAccountId = optional(
    row.default_settlement_account_id,
    "default_settlement_account_id"
  )
  const investment =
    type === "INVESTMENT_ACCOUNT"
      ? {
          ...(settlementAccountId === undefined
            ? {}
            : {
                defaultSettlementAccountId:
                  settlementAccountId as LedgerAccountId,
              }),
        }
      : undefined

  if (type !== "INVESTMENT_ACCOUNT" && settlementAccountId !== undefined) {
    throw new TypeError("Non-investment financial account has settlement data")
  }

  return {
    financialAccount: {
      type,
      ...(optional(row.institution_name, "institution_name") === undefined
        ? {}
        : {
            institutionName: optional(row.institution_name, "institution_name"),
          }),
      ...(optional(row.display_reference, "display_reference") === undefined
        ? {}
        : {
            displayReference: optional(
              row.display_reference,
              "display_reference"
            ),
          }),
      ...(investment === undefined ? {} : { investment }),
    },
  }
}

function readAppearance(
  row: LedgerAccountRow,
  kind: LedgerAccountSnapshot["kind"],
  systemPurpose: SystemAccountPurpose | undefined
): Partial<Pick<LedgerAccountSnapshot, "iconKey" | "colorHex">> {
  const hasIcon = row.icon_key !== null && row.icon_key !== undefined
  const hasColor = row.color_hex !== null && row.color_hex !== undefined
  const managed =
    (kind === "INCOME" || kind === "EXPENSE") && systemPurpose === undefined

  if (!managed) {
    if (hasIcon || hasColor) {
      throw new TypeError(
        "Invalid ledger_accounts visual metadata for non-category account"
      )
    }
    return {}
  }

  if (typeof row.icon_key !== "string" || typeof row.color_hex !== "string") {
    throw new TypeError("Invalid ledger_accounts visual metadata")
  }

  try {
    const appearance = categoryAppearance({
      iconKey: row.icon_key,
      colorHex: row.color_hex,
    })
    if (appearance.colorHex !== row.color_hex) {
      throw new Error("non-canonical color")
    }
    return appearance
  } catch {
    throw new TypeError("Invalid ledger_accounts visual metadata")
  }
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Invalid ledger_accounts.${field}`)
  }

  return value
}

function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new TypeError(`Invalid ledger_accounts.${field}`)
  }

  return value as T
}

function readVersion(value: unknown): number {
  try {
    const version = readInteger(value, "ledger_accounts.version")
    if (version < 0) {
      throw new Error("negative version")
    }

    return version
  } catch {
    throw new TypeError("Invalid ledger_accounts.version")
  }
}
