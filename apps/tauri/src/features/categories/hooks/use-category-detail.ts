import { useQuery } from "@tanstack/react-query"

import { useActiveBook } from "../../../providers/active-book-provider.js"
import { categoryKeys } from "./category-keys.js"
import { useMyFin } from "../../../providers/my-fin-provider.js"

export function useCategoryDetail(categoryId: string | undefined) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const resolvedCategoryId = categoryId ?? "unresolved"

  return useQuery({
    queryKey: categoryKeys.detail(bookId ?? "unresolved", resolvedCategoryId),
    enabled: bookId !== null && categoryId !== undefined,
    retry: false,
    queryFn: async () => {
      if (bookId === null || categoryId === undefined) {
        throw new Error("Category detail requires an active book and category")
      }
      const result = await services.categories.get.execute({
        bookId,
        categoryId,
      })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
