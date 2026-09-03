import { useQuery } from "@tanstack/react-query"
import { useActiveBook, useMyFin } from "../../../providers"
import { categoryKeys } from "./category-keys"

export function useIncomeCategories() {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null

  return useQuery({
    queryKey: categoryKeys.incomeCategories(bookId ?? "unresolved"),
    enabled: bookId !== null,
    retry: false,
    queryFn: async () => {
      if (bookId === null) throw new Error("No active book")
      const result = await services.categories.listIncome.execute({ bookId })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
