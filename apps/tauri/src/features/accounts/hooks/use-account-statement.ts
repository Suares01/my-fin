import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query"
import { AccountStatementItem, QueryPage } from "@workspace/application"
import { useActiveBook, useMyFin } from "../../../providers"
import { accountKeys } from "./account-keys"

const STATEMENT_PAGE_SIZE = 20

export type AccountStatementData = InfiniteData<
  QueryPage<AccountStatementItem>,
  string | undefined
> & {
  readonly items: readonly AccountStatementItem[]
  readonly nextCursor: string | null
}

export function dedupeStatementItems(
  pages: readonly QueryPage<AccountStatementItem>[]
): readonly AccountStatementItem[] {
  const seen = new Set<string>()
  const items: AccountStatementItem[] = []
  for (const page of pages) {
    for (const item of page.items) {
      const key = item.postingId || item.entryId
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }
  }
  return items
}

export function useAccountStatement(accountId: string | undefined) {
  const services = useMyFin()
  const { session } = useActiveBook()
  const bookId = session.status === "ACTIVE" ? session.bookId : null
  const scopedBookId = bookId ?? "unresolved"
  const scopedAccountId = accountId ?? "unresolved"

  return useInfiniteQuery({
    queryKey: accountKeys.statement(scopedBookId, scopedAccountId),
    enabled: bookId !== null && accountId !== undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (bookId === null || accountId === undefined) {
        throw new Error("Account statement requires an active book and account")
      }
      const result = await services.accounts.listStatement.execute({
        bookId,
        accountId,
        limit: STATEMENT_PAGE_SIZE,
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      })
      if (!result.ok) throw result.error
      return result.value
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data): AccountStatementData => ({
      ...data,
      items: dedupeStatementItems(data.pages),
      nextCursor: data.pages.at(-1)?.nextCursor ?? null,
    }),
  })
}
