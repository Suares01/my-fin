import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  AccountDto,
  ConfigureFinancialAccountCommand,
} from "@workspace/application"
import { useMyFin } from "../../../providers"
import { accountKeys } from "./account-keys"

export function useConfigureAccount() {
  const services = useMyFin()
  const queryClient = useQueryClient()

  return useMutation<AccountDto, Error, ConfigureFinancialAccountCommand>({
    mutationFn: async (command) => {
      const result = await services.accounts.configure.execute(command)
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
        queryClient.invalidateQueries({
          queryKey: ["investments", command.bookId],
          exact: false,
        }),
      ]).then(() => undefined),
  })
}
