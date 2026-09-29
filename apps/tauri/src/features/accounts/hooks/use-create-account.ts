import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMyFin } from "../../../providers"
import {
  AccountDto,
  CreateFinancialAccountCommand,
} from "@workspace/application"
import { accountKeys } from "./account-keys"

export function useCreateAccount() {
  const services = useMyFin()
  const queryClient = useQueryClient()

  return useMutation<AccountDto, Error, CreateFinancialAccountCommand>({
    mutationFn: async (command) => {
      const result = await services.accounts.create.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: (_account, command) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.balances(command.bookId),
          exact: true,
        }),
        ...(command.type === "INVESTMENT_ACCOUNT"
          ? [
              queryClient.invalidateQueries({
                queryKey: accountKeys.balances(command.bookId, true),
                exact: true,
              }),
              queryClient.invalidateQueries({
                queryKey: ["investments", command.bookId],
                exact: false,
              }),
            ]
          : []),
      ]).then(() => undefined),
  })
}
