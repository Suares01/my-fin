import type { QueryClient } from "@tanstack/react-query"
import type { FinancialBookSummary } from "@workspace/application"

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

export const initialActiveBookSession: ActiveBookSession = {
  status: "UNRESOLVED",
}

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
