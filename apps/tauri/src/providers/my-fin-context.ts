import { createContext } from "react"
import type { MyFinServices } from "../bootstrap/create-services.js"

export const MyFinContext = createContext<MyFinServices | null>(null)
