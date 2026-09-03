import { useQuery } from "@tanstack/react-query"

import { useMyFin } from "../../../providers/use-my-fin.js"
import { useActiveBook } from "../../../providers/use-active-book.js"
import { bookKeys } from "./book-keys.js"

export function useBookDetail(bookId?: string) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const resolvedBookId = bookId ?? activeBookId

  return useQuery({
    queryKey: bookKeys.detail(resolvedBookId ?? "unresolved"),
    enabled: resolvedBookId !== undefined && resolvedBookId !== null,
    retry: false,
    queryFn: async () => {
      if (resolvedBookId === undefined || resolvedBookId === null) {
        throw new Error("Book detail requires an active book")
      }
      const result = await services.books.get.execute({
        bookId: resolvedBookId,
      })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
