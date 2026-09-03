import type { JournalChainDetail } from "@workspace/application"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { useEffect } from "react"
import { IncomeForm } from "./income-form.js"
import { ExpenseForm } from "./expense-form.js"
import { TransferForm } from "./transfer-form.js"
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
  useEffect(() => {
    onStateChange({ kind: "closed" })
  }, [bookId, onStateChange])
  if (state.kind === "closed") return null
  const close = () => onStateChange({ kind: "closed" })
  if (state.kind === "delete")
    return (
      <TransactionDeleteDialog
        detail={state.detail}
        onConfirm={async () => {
          onSuccess()
          close()
        }}
        onCancel={close}
      />
    )
  const content =
    state.kind === "create" ? (
      <CreateChooser onChoose={(kind) => onStateChange({ kind })} />
    ) : state.kind === "income" ? (
      <IncomeForm
        onSubmit={async () => {
          onSuccess()
          close()
        }}
        onCancel={close}
      />
    ) : state.kind === "expense" ? (
      <ExpenseForm
        onSubmit={async () => {
          onSuccess()
          close()
        }}
        onCancel={close}
      />
    ) : (
      <TransferForm
        onSubmit={async () => {
          onSuccess()
          close()
        }}
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
