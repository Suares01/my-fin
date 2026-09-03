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

export type ExpenseDraft = Omit<CategorizedJournalDraft, "type"> & {
  readonly type: "EXPENSE"
}

export type RecordExpenseInput = {
  readonly bookId: string
  readonly draft: ExpenseDraft
}

export function useRecordExpense() {
  const services = useMyFin()

  return useTransactionMutation<RecordExpenseInput, JournalEntryDto>({
    execute: async ({ bookId, draft }) => {
      return services.expenses.record.execute({
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
