import { useEffect } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { useMyFin } from "../../../providers/use-my-fin.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { bookKeys } from "./book-keys.js"
import { isEntityNotFound, resolveBookSession } from "./book-session.js"
import { useBookRouteNavigation } from "./use-book-route-navigation.js"
import { FinancialBookSummary } from "@workspace/application"

export function useBooks(): UseQueryResult<
  readonly FinancialBookSummary[],
  Error
> {
  const services = useMyFin()
  const { session, actions } = useActiveBook()
  const { activateAndOpenDashboard, requireCreationAndOpen } =
    useBookRouteNavigation()
  const query = useQuery({
    queryKey: bookKeys.all,
    // Catalog failures are actionable in the page. Retrying invisibly keeps
    // the route in a pending/null state and hides the safe recovery alert.
    retry: false,
    queryFn: async () => {
      const result = await services.books.list.execute()
      if (!result.ok) throw result.error
      return result.value
    },
  })

  useEffect(() => {
    if (
      query.error &&
      session.status === "ACTIVE" &&
      isEntityNotFound(query.error)
    ) {
      actions.clear()
      return
    }
    if (!query.data) return
    const transition = resolveBookSession(session, query.data)
    if (transition) {
      if (
        transition.type === "REQUIRE_SELECTION" &&
        session.status === "REQUIRES_SELECTION" &&
        session.books === transition.books
      ) {
        return
      }
      if (
        transition.type === "REQUIRE_CREATION" &&
        session.status === "REQUIRES_CREATION"
      ) {
        return
      }
      switch (transition.type) {
        case "ACTIVATE":
          activateAndOpenDashboard(transition.bookId)
          break
        case "CLEAR":
          actions.clear()
          break
        case "REQUIRE_CREATION":
          requireCreationAndOpen()
          break
        case "REQUIRE_SELECTION":
          actions.requireSelection(transition.books)
          break
      }
    }
  }, [
    actions,
    activateAndOpenDashboard,
    query.data,
    query.error,
    requireCreationAndOpen,
    session,
  ])

  return query
}
