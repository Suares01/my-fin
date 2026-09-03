import { useContext } from "react"
import type { MyFinServices } from "../bootstrap/create-services.js"
import { MyFinContext } from "./my-fin-context"

export function useMyFin(): MyFinServices {
  const services = useContext(MyFinContext)
  if (services === null) {
    throw new Error("useMyFin must be used within MyFinProvider")
  }
  return services
}
