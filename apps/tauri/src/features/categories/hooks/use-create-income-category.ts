import { useMyFin } from "../../../providers"
import type { CreateCategoryCommand } from "@workspace/application"
import { useCategoryMutation } from "./category-mutation.js"

export function useCreateIncomeCategory() {
  const services = useMyFin()

  return useCategoryMutation<CreateCategoryCommand>({
    execute: (command) => services.categories.createIncome.execute(command),
  })
}
