import { createContext, useContext, type ReactNode } from "react"
import type { MyFinServices } from "../bootstrap/create-services.js"

const MyFinContext = createContext<MyFinServices | null>(null)

export function MyFinProvider({
  services,
  children,
}: {
  readonly services: MyFinServices
  readonly children: ReactNode
}) {
  return (
    <MyFinContext.Provider value={services}>{children}</MyFinContext.Provider>
  )
}

export function useMyFin(): MyFinServices {
  const services = useContext(MyFinContext)

  if (services === null) {
    throw new Error("useMyFin must be used within MyFinProvider")
  }

  return services
}
