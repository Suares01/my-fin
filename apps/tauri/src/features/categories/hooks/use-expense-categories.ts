import { useQuery } from "@tanstack/react-query"
import { useActiveBook, useMyFin } from "../../../providers"
import { categoryKeys } from "./category-keys"

export function useExpenseCategories() {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null

  return useQuery({
    queryKey: categoryKeys.expenseCategories(bookId ?? "unresolved"),
    enabled: bookId !== null,
    queryFn: async () => {
      if (bookId === null) throw new Error("No active book")
      const result = await services.categories.listExpenses.execute({ bookId })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
