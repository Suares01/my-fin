import {
  normalBalanceOf,
  type JournalEntryOrigin,
  type LedgerAccountKind,
  type LedgerAccountStatus,
} from "@workspace/domain"

const ACCOUNT_KINDS = [
  "ASSET",
  "LIABILITY",
  "INCOME",
  "EXPENSE",
  "EQUITY",
] as const
const ACCOUNT_STATUSES = ["ACTIVE", "ARCHIVED"] as const
const JOURNAL_ORIGINS = ["MANUAL", "SYSTEM"] as const

export function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw invalidValue(field)
  }

  return value
}

export function readBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") {
    return value
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value)
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    try {
      return BigInt(value)
    } catch {
      throw invalidValue(field)
    }
  }

  throw invalidValue(field)
}

export function readInteger(value: unknown, field: string): number {
  const parsed = readBigInt(value, field)
  if (
    parsed < BigInt(Number.MIN_SAFE_INTEGER) ||
    parsed > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw invalidValue(field)
  }

  return Number(parsed)
}

export function readBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") {
    return value
  }

  if (value === 0 || value === 1) {
    return value === 1
  }

  throw invalidValue(field)
}

export function readAccountKind(value: unknown): LedgerAccountKind {
  if (!ACCOUNT_KINDS.includes(value as LedgerAccountKind)) {
    throw invalidValue("accountKind")
  }

  return value as LedgerAccountKind
}

export function readAccountStatus(value: unknown): LedgerAccountStatus {
  if (!ACCOUNT_STATUSES.includes(value as LedgerAccountStatus)) {
    throw invalidValue("accountStatus")
  }

  return value as LedgerAccountStatus
}

export function readJournalOrigin(value: unknown): JournalEntryOrigin {
  if (!JOURNAL_ORIGINS.includes(value as JournalEntryOrigin)) {
    throw invalidValue("journalOrigin")
  }

  return value as JournalEntryOrigin
}

export function toDisplayMinor(raw: bigint, kind: LedgerAccountKind): string {
  return (normalBalanceOf(kind) === "DEBIT" ? raw : -raw).toString()
}

export function compareDecimalStrings(left: string, right: string): number {
  validateDecimal(left, "left")
  validateDecimal(right, "right")
  const normalizedLeft = left.replace(/^0+(?=\d)/, "")
  const normalizedRight = right.replace(/^0+(?=\d)/, "")
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1
  }

  if (normalizedLeft === normalizedRight) {
    return 0
  }

  return normalizedLeft < normalizedRight ? -1 : 1
}

function validateDecimal(value: string, field: string): void {
  if (!/^\d+$/.test(value)) {
    throw invalidValue(field)
  }
}

function invalidValue(field: string): TypeError {
  return new TypeError(`Invalid ledger query ${field}`)
}
