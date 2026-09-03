import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMyFin } from "../../../providers"
import {
  AccountDto,
  ArchiveLedgerAccountCommand,
  ReactivateLedgerAccountCommand,
  RenameLedgerAccountCommand,
} from "@workspace/application"
import { invalidateLifecycleQueries } from "../../query-invalidation"

type LifecycleAction = "rename" | "archive" | "reactivate"

function useCategoryLifecycle<
  TCommand extends { readonly bookId: string; readonly accountId: string },
>(action: LifecycleAction) {
  const services = useMyFin()
  const queryClient = useQueryClient()

  return useMutation<AccountDto, Error, TCommand>({
    mutationFn: async (command) => {
      const handler = services.categories[action] as unknown as {
        execute(
          input: TCommand
        ): Promise<
          { ok: true; value: AccountDto } | { ok: false; error: Error }
        >
      }
      const result = await handler.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: (_category, command) =>
      invalidateLifecycleQueries(queryClient, {
        bookId: command.bookId,
        accountId: command.accountId,
        scope: "category",
      }).then(() => undefined),
  })
}

export function useRenameCategory() {
  return useCategoryLifecycle<RenameLedgerAccountCommand>("rename")
}

export function useArchiveCategory() {
  return useCategoryLifecycle<ArchiveLedgerAccountCommand>("archive")
}

export function useReactivateCategory() {
  return useCategoryLifecycle<ReactivateLedgerAccountCommand>("reactivate")
}
