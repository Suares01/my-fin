import { useContext } from "react"
import { ActiveBookContext } from "./active-book-context"
import type { ActiveBookContextValue } from "./active-book-model"

export function useActiveBook(): ActiveBookContextValue {
  const value = useContext(ActiveBookContext)
  if (value === null) {
    throw new Error("useActiveBook must be used within ActiveBookProvider")
  }
  return value
}
