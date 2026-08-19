import {
  LedgerAccount,
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
}

export const LedgerAccountMapper = {
  toDomain(row: LedgerAccountRow): LedgerAccount {
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
      kind: readEnum(row.kind, ACCOUNT_KINDS, "kind"),
      status: readEnum(row.status, ACCOUNT_STATUSES, "status"),
      ...(row.system_purpose === null
        ? {}
        : {
            systemPurpose: readEnum(
              row.system_purpose,
              SYSTEM_PURPOSES,
              "system_purpose"
            ),
          }),
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
    }
  },
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
