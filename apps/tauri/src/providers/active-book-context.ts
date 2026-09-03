import { createContext } from "react"
import type { ActiveBookContextValue } from "./active-book-model"

export const ActiveBookContext = createContext<ActiveBookContextValue | null>(
  null
)
