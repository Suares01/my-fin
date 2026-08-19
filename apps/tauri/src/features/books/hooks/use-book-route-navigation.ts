import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"

import {
  useActiveBook,
  type ActiveBookSession,
} from "../../../providers/active-book-provider.js"

type PendingBookNavigation =
  | { readonly status: "REQUIRES_CREATION"; readonly to: "/books/new" }
  | {
      readonly status: "ACTIVE"
      readonly bookId: string
      readonly to: "/dashboard"
    }

export type BookRouteNavigation = {
  readonly activateAndOpenDashboard: (bookId: string) => void
  readonly requireCreationAndOpen: () => void
}

function matchesPendingSession(
  session: ActiveBookSession,
  pending: PendingBookNavigation
): boolean {
  if (pending.status === "REQUIRES_CREATION") {
    return session.status === "REQUIRES_CREATION"
  }

  return session.status === "ACTIVE" && session.bookId === pending.bookId
}

export function useBookRouteNavigation(): BookRouteNavigation {
  const { session, actions } = useActiveBook()
  const navigate = useNavigate()
  const [pending, setPending] = useState<PendingBookNavigation | null>(null)
  const requestId = useRef(0)

  const activateAndOpenDashboard = useCallback(
    (bookId: string) => {
      actions.activate(bookId)
      setPending({ status: "ACTIVE", bookId, to: "/dashboard" })
    },
    [actions]
  )

  const requireCreationAndOpen = useCallback(() => {
    actions.requireCreation()
    setPending({ status: "REQUIRES_CREATION", to: "/books/new" })
  }, [actions])

  useEffect(() => {
    if (!pending || !matchesPendingSession(session, pending)) return

    const currentRequestId = ++requestId.current
    let cancelled = false

    void Promise.resolve().then(() => {
      if (cancelled || requestId.current !== currentRequestId) return
      setPending(null)
      void navigate(pending.to)
    })

    return () => {
      cancelled = true
    }
  }, [navigate, pending, session])

  return { activateAndOpenDashboard, requireCreationAndOpen }
}
