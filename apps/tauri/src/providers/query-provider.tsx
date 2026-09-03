import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { createMyFinQueryClient } from "./query-client"

export function MyFinQueryProvider({
  client,
  children,
}: {
  readonly client?: QueryClient
  readonly children: ReactNode
}) {
  const [queryClient] = useState(() => client ?? createMyFinQueryClient())

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
