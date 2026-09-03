import { useQuery } from "@tanstack/react-query"
import { useActiveBook, useMyFin } from "../../../providers"
import { accountKeys } from "./account-keys"

export function useAccountBalances(includeArchived = false) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null

  return useQuery({
    queryKey: accountKeys.balances(bookId ?? "unresolved", includeArchived),
    enabled: bookId !== null,
    queryFn: async () => {
      if (bookId === null) throw new Error("No active book")
      const result = await services.accounts.listBalances.execute({
        bookId,
        accountKinds: ["ASSET", "LIABILITY"],
        includeArchived,
        includeZeroBalance: true,
      })
      if (!result.ok) {
        console.error("[accounts] application error", {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
        })

        throw result.error
      }
      return result.value.items
    },
  })
}
