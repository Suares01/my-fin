import { useContext } from "react"
import { JournalViewStateContext } from "./journal-view-state-context"
import type { JournalViewStateContextValue } from "./journal-view-state-model"

export function useJournalViewState(): JournalViewStateContextValue {
  const value = useContext(JournalViewStateContext)
  if (value === null) {
    throw new Error(
      "useJournalViewState must be used within JournalViewStateProvider"
    )
  }
  return value
}
