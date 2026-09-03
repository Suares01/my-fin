import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMyFin } from "../../../providers"
import {
  JournalEntryDto,
  SetOpeningBalanceCommand,
} from "@workspace/application"
import { accountKeys } from "./account-keys"

export function useSetOpeningBalance() {
  const services = useMyFin()
  const queryClient = useQueryClient()

  return useMutation<JournalEntryDto, Error, SetOpeningBalanceCommand>({
    mutationFn: async (command) => {
      const result = await services.accounts.setOpeningBalance.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: (_entry, command) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.balances(command.bookId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: accountKeys.detail(command.bookId, command.accountId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: accountKeys.statement(command.bookId, command.accountId),
          exact: true,
        }),
      ]).then(() => undefined),
  })
}
