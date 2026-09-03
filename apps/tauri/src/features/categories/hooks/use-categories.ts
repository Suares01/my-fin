import { useQuery } from "@tanstack/react-query"

import { useActiveBook } from "../../../providers/use-active-book.js"
import { categoryKeys } from "./category-keys.js"
import { useMyFin } from "../../../providers/use-my-fin.js"

export function useCategories(includeArchived = true) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null

  return useQuery({
    queryKey: categoryKeys.list(bookId ?? "unresolved", includeArchived),
    enabled: bookId !== null,
    retry: false,
    queryFn: async () => {
      if (bookId === null) throw new Error("No active book")
      const result = await services.categories.list.execute({
        bookId,
        includeArchived,
      })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
