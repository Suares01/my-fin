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
      const { type: _type, ...command } = draft
      return services.income.record.execute({ bookId, ...command })
    },
    refresh: ({ bookId, draft }) => ({
      bookId,
      accountIds: [draft.accountId],
    }),
  })
}
