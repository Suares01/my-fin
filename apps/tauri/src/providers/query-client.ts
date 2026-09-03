import {
  keepPreviousData,
  QueryClient,
  type QueryClientConfig,
} from "@tanstack/react-query"

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
