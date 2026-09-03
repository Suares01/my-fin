import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { useActiveBook } from "../../../providers/use-active-book.js"
import { JournalViewStateContext } from "./journal-view-state-context"
import {
  emptyJournalViewState,
  normalizeJournalViewFilters,
  type JournalViewState,
  type JournalViewStateContextValue,
} from "./journal-view-state-model"

export function JournalViewStateProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const { session } = useActiveBook()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const previousBookId = useRef<string | null>(activeBookId)
  const [state, setState] = useState<JournalViewState>({
    ...emptyJournalViewState,
    bookId: activeBookId,
  })

  useEffect(() => {
    if (previousBookId.current === activeBookId) return
    previousBookId.current = activeBookId
    setState({ ...emptyJournalViewState, bookId: activeBookId })
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
        setState((current) => ({
          ...emptyJournalViewState,
          bookId: current.bookId,
        })),
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
