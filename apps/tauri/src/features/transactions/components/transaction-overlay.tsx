import type { JournalChainDetail } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { useEffect } from "react"
import { editDraftFromDetail } from "../transaction-form-model.js"
import { useAmendTransaction } from "../hooks/use-amend-transaction.js"
import { useRecordExpense } from "../hooks/use-record-expense.js"
import { useRecordIncome } from "../hooks/use-record-income.js"
import { useReverseTransaction } from "../hooks/use-reverse-transaction.js"
import { useTransferMoney } from "../hooks/use-transfer-money.js"
import { IncomeForm, type IncomeTransactionDraft } from "./income-form.js"
import { ExpenseForm, type ExpenseTransactionDraft } from "./expense-form.js"
import { TransferForm, type TransferTransactionDraft } from "./transfer-form.js"
import { TransactionDeleteDialog } from "./transaction-delete-dialog.js"

export type TransactionOverlayState =
  | { readonly kind: "closed" }
  | { readonly kind: "create" }
  | {
      readonly kind: "income" | "expense" | "transfer"
      readonly detail?: JournalChainDetail
    }
  | { readonly kind: "delete"; readonly detail: JournalChainDetail }

type TransactionOverlayProps = {
  readonly bookId: string | null
  readonly state: TransactionOverlayState
  readonly onStateChange: (state: TransactionOverlayState) => void
  readonly onSuccess: () => void
}

export function TransactionOverlay({
  bookId,
  state,
  onStateChange,
  onSuccess,
}: TransactionOverlayProps) {
  const recordIncome = useRecordIncome()
  const recordExpense = useRecordExpense()
  const transferMoney = useTransferMoney()
  const amendTransaction = useAmendTransaction()
  const reverseTransaction = useReverseTransaction()

  useEffect(() => {
    onStateChange({ kind: "closed" })
  }, [bookId, onStateChange])
  if (state.kind === "closed") return null
  const close = () => onStateChange({ kind: "closed" })
  if (state.kind === "delete")
    return (
      <TransactionDeleteDialog
        detail={state.detail}
        pending={reverseTransaction.isPending}
        submitError={reverseTransaction.error}
        onConfirm={async ({ occurredOn, description }) => {
          if (bookId === null) return
          await reverseTransaction.mutateAsync({
            bookId,
            chainId: state.detail.chainId,
            presentedEntryId: state.detail.presentedEntryId,
            presentedVersion: state.detail.presentedVersion,
            presentedOccurredOn: state.detail.occurredOn,
            occurredOn,
            description,
            previousDetail: state.detail,
          })
          onSuccess()
          close()
        }}
        onCancel={close}
      />
    )
  const detail = state.kind === "create" ? undefined : state.detail
  const editDraft =
    detail === undefined ? undefined : editDraftFromDetail(detail)
  if (editDraft?.ok === false)
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível editar a transação</AlertTitle>
        <AlertDescription>
          Os dados atuais da transação não permitem uma edição segura.
        </AlertDescription>
      </Alert>
    )
  const submitIncome = async (draft: IncomeTransactionDraft) => {
    if (bookId === null) return
    if (detail !== undefined) {
      await amendTransaction.mutateAsync({
        bookId,
        chainId: detail.chainId,
        presentedEntryId: detail.presentedEntryId,
        presentedVersion: detail.presentedVersion,
        replacement: draft,
        previousDetail: detail,
      })
    } else {
      await recordIncome.mutateAsync({ bookId, draft })
    }
    onSuccess()
    close()
  }
  const submitExpense = async (draft: ExpenseTransactionDraft) => {
    if (bookId === null) return
    if (detail !== undefined) {
      await amendTransaction.mutateAsync({
        bookId,
        chainId: detail.chainId,
        presentedEntryId: detail.presentedEntryId,
        presentedVersion: detail.presentedVersion,
        replacement: draft,
        previousDetail: detail,
      })
    } else {
      await recordExpense.mutateAsync({ bookId, draft })
    }
    onSuccess()
    close()
  }
  const submitTransfer = async (draft: TransferTransactionDraft) => {
    if (bookId === null) return
    if (detail !== undefined) {
      await amendTransaction.mutateAsync({
        bookId,
        chainId: detail.chainId,
        presentedEntryId: detail.presentedEntryId,
        presentedVersion: detail.presentedVersion,
        replacement: draft,
        previousDetail: detail,
      })
    } else {
      await transferMoney.mutateAsync({ bookId, draft })
    }
    onSuccess()
    close()
  }
  const content =
    state.kind === "create" ? (
      <CreateChooser onChoose={(kind) => onStateChange({ kind })} />
    ) : state.kind === "income" ? (
      <IncomeForm
        initialDraft={
          editDraft?.ok === true && detail?.type === "INCOME"
            ? (editDraft.draft as IncomeTransactionDraft)
            : undefined
        }
        pending={recordIncome.isPending || amendTransaction.isPending}
        submitError={recordIncome.error ?? amendTransaction.error}
        onSubmit={submitIncome}
        onCancel={close}
      />
    ) : state.kind === "expense" ? (
      <ExpenseForm
        initialDraft={
          editDraft?.ok === true && detail?.type === "EXPENSE"
            ? (editDraft.draft as ExpenseTransactionDraft)
            : undefined
        }
        pending={recordExpense.isPending || amendTransaction.isPending}
        submitError={recordExpense.error ?? amendTransaction.error}
        onSubmit={submitExpense}
        onCancel={close}
      />
    ) : (
      <TransferForm
        initialDraft={
          editDraft?.ok === true && detail?.type === "TRANSFER"
            ? (editDraft.draft as TransferTransactionDraft)
            : undefined
        }
        pending={transferMoney.isPending || amendTransaction.isPending}
        submitError={transferMoney.error ?? amendTransaction.error}
        onSubmit={submitTransfer}
        onCancel={close}
      />
    )
  const title =
    state.kind === "create"
      ? "Nova transação"
      : state.kind === "income"
        ? "Receita"
        : state.kind === "expense"
          ? "Despesa"
          : "Transferência"

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl"
        aria-label={title}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Preencha os dados da transação.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto p-6">{content}</div>
      </SheetContent>
    </Sheet>
  )
}

function CreateChooser({
  onChoose,
}: {
  readonly onChoose: (kind: "income" | "expense" | "transfer") => void
}) {
  return (
    <div className="grid gap-3">
      <Button type="button" onClick={() => onChoose("income")}>
        Receita
      </Button>
      <Button type="button" onClick={() => onChoose("expense")}>
        Despesa
      </Button>
      <Button type="button" onClick={() => onChoose("transfer")}>
        Transferência
      </Button>
    </div>
  )
}
