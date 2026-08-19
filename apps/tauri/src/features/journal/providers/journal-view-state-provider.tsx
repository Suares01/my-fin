import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useActiveBook } from "../../../providers/active-book-provider.js"

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

const emptyState: JournalViewState = {
  bookId: null,
  filters: {},
  page: 0,
  anchor: null,
}

const JournalViewStateContext =
  createContext<JournalViewStateContextValue | null>(null)

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

export function JournalViewStateProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const { session } = useActiveBook()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const previousBookId = useRef<string | null>(activeBookId)
  const [state, setState] = useState<JournalViewState>({
    ...emptyState,
    bookId: activeBookId,
  })

  useEffect(() => {
    if (previousBookId.current === activeBookId) return
    previousBookId.current = activeBookId
    setState({ ...emptyState, bookId: activeBookId })
  }, [activeBookId])

  const actions = useMemo<JournalViewStateContextValue["actions"]>(
    () => ({
      setFilters: (filters) =>
        setState((current) => ({
          ...current,
          filters: normalizeJournalViewFilters(filters),
          page: 0,
          anchor: null,
        })),
      setPage: (page) =>
        setState((current) => ({ ...current, page: Math.max(0, page) })),
      setAnchor: (anchor) => setState((current) => ({ ...current, anchor })),
      reset: () =>
        setState((current) => ({ ...emptyState, bookId: current.bookId })),
    }),
    []
  )

  const value = useMemo(() => ({ state, actions }), [actions, state])
  return (
    <JournalViewStateContext.Provider value={value}>
      {children}
    </JournalViewStateContext.Provider>
  )
}

export function useJournalViewState(): JournalViewStateContextValue {
  const value = useContext(JournalViewStateContext)
  if (value === null)
    throw new Error(
      "useJournalViewState must be used within JournalViewStateProvider"
    )
  return value
}
