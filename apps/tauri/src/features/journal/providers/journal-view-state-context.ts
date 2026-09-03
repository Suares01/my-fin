import { createContext } from "react"
import type { JournalViewStateContextValue } from "./journal-view-state-model"

export const JournalViewStateContext =
  createContext<JournalViewStateContextValue | null>(null)
