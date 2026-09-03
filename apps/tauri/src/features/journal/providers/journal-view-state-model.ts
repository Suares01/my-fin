export type JournalViewFilters = {
  readonly from?: string
  readonly to?: string
  readonly accountIds?: readonly string[]
  readonly categoryIds?: readonly string[]
  readonly types?: readonly string[]
  readonly origins?: readonly string[]
  readonly search?: string
}

export type JournalAnchor = {
  readonly chainId: string
  readonly offset: number
}

export type JournalViewState = {
  readonly bookId: string | null
  readonly filters: JournalViewFilters
  readonly page: number
  readonly anchor: JournalAnchor | null
}

export type JournalViewStateContextValue = {
  readonly state: JournalViewState
  readonly actions: {
    readonly setFilters: (filters: JournalViewFilters) => void
    readonly setPage: (page: number) => void
    readonly setAnchor: (anchor: JournalAnchor | null) => void
    readonly reset: () => void
  }
}

export const emptyJournalViewState: JournalViewState = {
  bookId: null,
  filters: {},
  page: 0,
  anchor: null,
}

export function normalizeJournalViewFilters(
  filters: JournalViewFilters
): JournalViewFilters {
  const normalizeList = (values: readonly string[] | undefined) => {
    if (values === undefined) return undefined
    const normalized = [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ].sort()
    return normalized.length === 0 ? undefined : normalized
  }
  const search =
    filters.search === undefined
      ? undefined
      : filters.search.trim().normalize("NFC").toLowerCase()

  return {
    ...(filters.from === undefined ? {} : { from: filters.from.trim() }),
    ...(filters.to === undefined ? {} : { to: filters.to.trim() }),
    ...(normalizeList(filters.accountIds) === undefined
      ? {}
      : { accountIds: normalizeList(filters.accountIds) }),
    ...(normalizeList(filters.categoryIds) === undefined
      ? {}
      : { categoryIds: normalizeList(filters.categoryIds) }),
    ...(normalizeList(filters.types) === undefined
      ? {}
      : { types: normalizeList(filters.types) }),
    ...(normalizeList(filters.origins) === undefined
      ? {}
      : { origins: normalizeList(filters.origins) }),
    ...(search === undefined || search.length === 0 ? {} : { search }),
  }
}
