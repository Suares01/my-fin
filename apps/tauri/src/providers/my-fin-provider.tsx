import { type ReactNode } from "react"
import type { MyFinServices } from "../bootstrap/create-services.js"
import { MyFinContext } from "./my-fin-context"

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
