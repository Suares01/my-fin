import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

export function createMyFinQueryClient(
  config: QueryClientConfig = {}
): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        ...config.defaultOptions?.queries,
        placeholderData: keepPreviousData,
      },
      mutations: {
        ...config.defaultOptions?.mutations,
        retry: false,
      },
    },
  })
}

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
