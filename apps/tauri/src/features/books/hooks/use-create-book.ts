import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useMyFin } from "../../../providers/my-fin-provider.js"
import { bookKeys } from "./book-keys.js"
import { BookDto, CreateFinancialBookCommand } from "@workspace/application"

export function useCreateBook() {
  const services = useMyFin()
  const queryClient = useQueryClient()

  return useMutation<BookDto, Error, CreateFinancialBookCommand>({
    mutationFn: async (command) => {
      const result = await services.books.create.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: async (book) => {
      // Publish the committed DTO before invalidating the catalog. This keeps
      // the active session from observing the old empty result during the
      // refetch window immediately after the first-book mutation.
      queryClient.setQueryData(bookKeys.all, [book])
      await queryClient.invalidateQueries({ queryKey: bookKeys.all })
    },
  })
}
