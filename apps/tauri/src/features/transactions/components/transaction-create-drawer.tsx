import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import type { TransactionCreateType } from "../hooks/use-transaction-create-drawer.js"
import { useRecordExpense } from "../hooks/use-record-expense.js"
import { useRecordIncome } from "../hooks/use-record-income.js"
import { useTransferMoney } from "../hooks/use-transfer-money.js"
import { ExpenseForm, type ExpenseTransactionDraft } from "./expense-form.js"
import { IncomeForm, type IncomeTransactionDraft } from "./income-form.js"
import { TransferForm, type TransferTransactionDraft } from "./transfer-form.js"

type TransactionCreateDrawerProps = {
  readonly bookId: string
  readonly open: boolean
  readonly transactionType?: TransactionCreateType
  readonly onOpenChange: (open: boolean) => void
}

function transactionTypeLabel(type: TransactionCreateType): string {
  switch (type) {
    case "INCOME":
      return "receita"
    case "EXPENSE":
      return "despesa"
    case "TRANSFER":
      return "transferência"
  }
}

export function TransactionCreateDrawer({
  bookId,
  open,
  transactionType,
  onOpenChange,
}: TransactionCreateDrawerProps) {
  const recordIncome = useRecordIncome()
  const recordExpense = useRecordExpense()
  const transferMoney = useTransferMoney()
  const closeDrawer = () => onOpenChange(false)

  const content =
    transactionType === "INCOME" ? (
      <IncomeForm
        pending={recordIncome.isPending}
        submitError={recordIncome.error}
        onSubmit={async (draft: IncomeTransactionDraft) => {
          await recordIncome.mutateAsync({ bookId, draft })
          closeDrawer()
        }}
        onCancel={closeDrawer}
      />
    ) : transactionType === "EXPENSE" ? (
      <ExpenseForm
        pending={recordExpense.isPending}
        submitError={recordExpense.error}
        onSubmit={async (draft: ExpenseTransactionDraft) => {
          await recordExpense.mutateAsync({ bookId, draft })
          closeDrawer()
        }}
        onCancel={closeDrawer}
      />
    ) : transactionType === "TRANSFER" ? (
      <TransferForm
        pending={transferMoney.isPending}
        submitError={transferMoney.error}
        onSubmit={async (draft: TransferTransactionDraft) => {
          await transferMoney.mutateAsync({ bookId, draft })
          closeDrawer()
        }}
        onCancel={closeDrawer}
      />
    ) : null

  return (
    <Drawer
      direction="right"
      modal={false}
      open={open}
      onOpenChange={onOpenChange}
    >
      {open && transactionType ? (
        <>
          <DrawerBackdrop data-slot="transaction-create-drawer-backdrop" />
          <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-xl">
            <DrawerHeader>
              <DrawerTitle>Criar {transactionTypeLabel(transactionType)}</DrawerTitle>
              <DrawerDescription>
                Preencha os dados para registrar a transação.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {content}
            </div>
          </DrawerContent>
        </>
      ) : null}
    </Drawer>
  )
}
