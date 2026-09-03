import { useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ActiveBookContext } from "./active-book-context"
import {
  clearBookScopedQueries,
  initialActiveBookSession,
  transitionActiveBookSession,
  type ActiveBookActions,
  type ActiveBookSession,
} from "./active-book-model"

export function ActiveBookProvider({
  children,
  initial = initialActiveBookSession,
}: {
  readonly children: ReactNode
  readonly initial?: ActiveBookSession
}) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<ActiveBookSession>(initial)

  const actions = useMemo<ActiveBookActions>(
    () => ({
      activate: (bookId) => {
        setSession((previous) => {
          if (previous.status === "ACTIVE" && previous.bookId !== bookId) {
            clearBookScopedQueries(queryClient, previous.bookId)
          }
          return transitionActiveBookSession(previous, {
            type: "ACTIVATE",
            bookId,
          })
        })
      },
      requireCreation: () => {
        setSession((previous) => {
          if (previous.status === "ACTIVE") {
            clearBookScopedQueries(queryClient, previous.bookId)
          }
          return transitionActiveBookSession(previous, {
            type: "REQUIRE_CREATION",
          })
        })
      },
      requireSelection: (books) => {
        setSession((previous) => {
          if (previous.status === "ACTIVE") {
            clearBookScopedQueries(queryClient, previous.bookId)
          }
          return transitionActiveBookSession(previous, {
            type: "REQUIRE_SELECTION",
            books,
          })
        })
      },
      clear: () => {
        setSession((previous) => {
          if (previous.status === "ACTIVE") {
            clearBookScopedQueries(queryClient, previous.bookId)
          }
          return transitionActiveBookSession(previous, { type: "CLEAR" })
        })
      },
    }),
    [queryClient]
  )

  const value = useMemo(() => ({ session, actions }), [actions, session])

  return (
    <ActiveBookContext.Provider value={value}>
      {children}
    </ActiveBookContext.Provider>
  )
}
