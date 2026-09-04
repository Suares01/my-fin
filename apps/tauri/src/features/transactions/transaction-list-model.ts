import type {
  JournalBusinessType,
  JournalChainListItem,
  JournalChainStatus,
} from "@workspace/application"

export type TransactionType = Exclude<JournalBusinessType, "OPENING_BALANCE">
export type TransactionStatusFilter = "ALL" | JournalChainStatus

export type TransactionFilters = {
  readonly from: string
  readonly to: string
  readonly search: string
  readonly types: readonly TransactionType[]
  readonly accountIds: readonly string[]
  readonly categoryIds: readonly string[]
  readonly status: TransactionStatusFilter
}

export type TransactionServerFilters = {
  readonly from?: string
  readonly to?: string
  readonly search?: string
  readonly types: readonly TransactionType[]
  readonly accountIds?: readonly string[]
  readonly categoryIds?: readonly string[]
}

export type TransactionSummary = {
  readonly incomeMinor: bigint
  readonly expenseMinor: bigint
  readonly largestAbsoluteMinor: bigint
  readonly count: number
}

function normalizeText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized === "" ? undefined : normalized
}

function normalizeIds(
  values: readonly string[]
): readonly string[] | undefined {
  const normalized = [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort()
  return normalized.length === 0 ? undefined : normalized
}

function normalizeTypes(
  values: readonly TransactionType[]
): readonly TransactionType[] {
  return [...new Set(values)].sort()
}

export function normalizeTransactionServerFilters(
  filters: TransactionFilters
): TransactionServerFilters {
  const from = normalizeText(filters.from)
  const to = normalizeText(filters.to)
  const search = normalizeText(filters.search)?.normalize("NFC").toLowerCase()
  const accountIds = normalizeIds(filters.accountIds)
  const categoryIds = normalizeIds(filters.categoryIds)

  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(search === undefined ? {} : { search }),
    types: normalizeTypes(filters.types),
    ...(accountIds === undefined ? {} : { accountIds }),
    ...(categoryIds === undefined ? {} : { categoryIds }),
  }
}

export function filterTransactionChainsByStatus(
  items: readonly JournalChainListItem[],
  status: TransactionStatusFilter
): readonly JournalChainListItem[] {
  return status === "ALL"
    ? items
    : items.filter((item) => item.status === status)
}

export function transactionAmountSign(type: TransactionType): "+" | "-" | "" {
  if (type === "INCOME") return "+"
  if (type === "EXPENSE") return "-"
  return ""
}

export function summarizeTransactionChains(
  items: readonly JournalChainListItem[]
): TransactionSummary {
  let incomeMinor = 0n
  let expenseMinor = 0n
  let largestAbsoluteMinor = 0n

  for (const item of items) {
    const amountMinor = BigInt(item.amountMinor)
    if (item.type === "INCOME") incomeMinor += amountMinor
    if (item.type === "EXPENSE") expenseMinor -= amountMinor
    if (amountMinor > largestAbsoluteMinor) largestAbsoluteMinor = amountMinor
  }

  return {
    incomeMinor,
    expenseMinor,
    largestAbsoluteMinor,
    count: items.length,
  }
}
