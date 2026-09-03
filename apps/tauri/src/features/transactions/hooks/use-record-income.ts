import type {
  JournalBusinessDraft,
  JournalEntryDto,
} from "@workspace/application"
import { useMyFin } from "../../../providers/index.js"
import { useTransactionMutation } from "./transaction-mutation.js"

type CategorizedJournalDraft = Extract<
  JournalBusinessDraft,
  { readonly type: "INCOME" | "EXPENSE" }
>

export type IncomeDraft = Omit<CategorizedJournalDraft, "type"> & {
  readonly type: "INCOME"
}

export type RecordIncomeInput = {
  readonly bookId: string
  readonly draft: IncomeDraft
}

export function useRecordIncome() {
  const services = useMyFin()

  return useTransactionMutation<RecordIncomeInput, JournalEntryDto>({
    execute: async ({ bookId, draft }) => {
      return services.income.record.execute({
        bookId,
        accountId: draft.accountId,
        categoryId: draft.categoryId,
        amountMinor: draft.amountMinor,
        currency: draft.currency,
        occurredOn: draft.occurredOn,
        description: draft.description,
      })
    },
    refresh: ({ bookId, draft }) => ({
      bookId,
      accountIds: [draft.accountId],
    }),
  })
}
