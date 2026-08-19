import { useState, type ReactNode } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { ActiveBookProvider } from "./active-book-provider.js"
import { MyFinProvider } from "./my-fin-provider.js"
import { createMyFinQueryClient, MyFinQueryProvider } from "./query-provider.js"
import type { MyFinServices } from "../bootstrap/create-services.js"
import { JournalViewStateProvider } from "../features/journal/providers/journal-view-state-provider.js"

export function MyFinProviders({
  services,
  children,
  client,
}: {
  readonly services: MyFinServices
  readonly children: ReactNode
  readonly client?: QueryClient
}) {
  const [queryClient] = useState(() => client ?? createMyFinQueryClient())

  return (
    <MyFinQueryProvider client={queryClient}>
      <MyFinProvider services={services}>
        <ActiveBookProvider>
          <JournalViewStateProvider>{children}</JournalViewStateProvider>
        </ActiveBookProvider>
      </MyFinProvider>
    </MyFinQueryProvider>
  )
}
