import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMyFin } from "../../../providers"
import { AccountDto, CreateCategoryCommand } from "@workspace/application"
import { categoryKeys } from "./category-keys"

export function useCreateIncomeCategory() {
  const services = useMyFin()
  const queryClient = useQueryClient()

  return useMutation<AccountDto, Error, CreateCategoryCommand>({
    mutationFn: async (command) => {
      const result = await services.categories.createIncome.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: async (_category, command) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: categoryKeys.incomeCategories(command.bookId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: categoryKeys.all(command.bookId),
        }),
      ])
    },
  })
}
