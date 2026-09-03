import type {
  JournalBusinessDraft,
  JournalEntryDto,
} from "@workspace/application"
import { useMyFin } from "../../../providers/index.js"
import { useTransactionMutation } from "./transaction-mutation.js"

export type TransferDraft = Extract<
  JournalBusinessDraft,
  { readonly type: "TRANSFER" }
>

export type TransferMoneyInput = {
  readonly bookId: string
  readonly draft: TransferDraft
}

export class EqualTransferAccountsError extends Error {
  constructor() {
    super("Escolha contas diferentes.")
    this.name = "EqualTransferAccountsError"
  }
}

export function useTransferMoney() {
  const services = useMyFin()

  return useTransactionMutation<TransferMoneyInput, JournalEntryDto>({
    execute: async ({ bookId, draft }) => {
      if (draft.sourceAccountId === draft.destinationAccountId) {
        throw new EqualTransferAccountsError()
      }
      const { type: _type, ...command } = draft
      return services.transfers.record.execute({ bookId, ...command })
    },
    refresh: ({ bookId, draft }) => ({
      bookId,
      accountIds: [draft.sourceAccountId, draft.destinationAccountId],
    }),
  })
}
