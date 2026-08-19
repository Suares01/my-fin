import type { FinancialBookSummary } from "@workspace/application"
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"

export type ActiveBookSession =
  | { readonly status: "UNRESOLVED" }
  | { readonly status: "REQUIRES_CREATION" }
  | {
      readonly status: "REQUIRES_SELECTION"
      readonly books: readonly FinancialBookSummary[]
    }
  | { readonly status: "ACTIVE"; readonly bookId: string }

export type ActiveBookActions = {
  readonly activate: (bookId: string) => void
  readonly requireCreation: () => void
  readonly requireSelection: (books: readonly FinancialBookSummary[]) => void
  readonly clear: () => void
}

export type ActiveBookContextValue = {
  readonly session: ActiveBookSession
  readonly actions: ActiveBookActions
}

export type ActiveBookTransition =
  | { readonly type: "ACTIVATE"; readonly bookId: string }
  | { readonly type: "REQUIRE_CREATION" }
  | {
      readonly type: "REQUIRE_SELECTION"
      readonly books: readonly FinancialBookSummary[]
    }
  | { readonly type: "CLEAR" }

const initialSession: ActiveBookSession = { status: "UNRESOLVED" }
const ActiveBookContext = createContext<ActiveBookContextValue | null>(null)

export function transitionActiveBookSession(
  _previous: ActiveBookSession,
  transition: ActiveBookTransition
): ActiveBookSession {
  switch (transition.type) {
    case "ACTIVATE":
      return { status: "ACTIVE", bookId: transition.bookId }
    case "REQUIRE_CREATION":
      return { status: "REQUIRES_CREATION" }
    case "REQUIRE_SELECTION":
      return { status: "REQUIRES_SELECTION", books: transition.books }
    case "CLEAR":
      return { status: "UNRESOLVED" }
  }
}

export function clearBookScopedQueries(
  queryClient: QueryClient,
  bookId: string
): void {
  queryClient.removeQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === "books" && queryKey[1] === bookId,
  })
}

export function ActiveBookProvider({
  children,
  initial = initialSession,
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

export function useActiveBook(): ActiveBookContextValue {
  const value = useContext(ActiveBookContext)

  if (value === null) {
    throw new Error("useActiveBook must be used within ActiveBookProvider")
  }

  return value
}
