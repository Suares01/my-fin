import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router"

export const BOOK_SWITCHER_NAVIGATION_STATE = {
  source: "nav-book-switcher",
} as const

export type BookNavigationState = typeof BOOK_SWITCHER_NAVIGATION_STATE

function isDocumentReloadNavigation(): boolean {
  if (typeof performance === "undefined") return false

  const navigationEntry = performance.getEntriesByType("navigation")[0]
  return (
    navigationEntry !== undefined &&
    "type" in navigationEntry &&
    navigationEntry.type === "reload"
  )
}

export function isBookSwitcherNavigationState(
  state: unknown
): state is BookNavigationState {
  return (
    typeof state === "object" &&
    state !== null &&
    "source" in state &&
    state.source === BOOK_SWITCHER_NAVIGATION_STATE.source
  )
}

export function useBookPageNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const canGoBack =
    !isDocumentReloadNavigation() &&
    isBookSwitcherNavigationState(location.state)

  const goBack = useCallback(() => {
    if (canGoBack) {
      navigate(-1)
    }
  }, [canGoBack, navigate])

  return {
    canGoBack,
    goBack,
    navigationState: canGoBack ? BOOK_SWITCHER_NAVIGATION_STATE : undefined,
  }
}
