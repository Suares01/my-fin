import { useActiveBook } from "../../../providers"
import { useTransactionCreateDrawer } from "../hooks/use-transaction-create-drawer.js"
import { TransactionCreateDrawer } from "./transaction-create-drawer.js"
import { TransactionCreateDropdown } from "./transaction-create-dropdown.js"

export function TransactionCreateQuickAction() {
  const { session } = useActiveBook()
  const {
    createDrawerOpen,
    creatingTransactionType,
    openCreateForm,
    setCreateDrawerOpen,
  } = useTransactionCreateDrawer()

  if (session.status !== "ACTIVE") return null

  return (
    <>
      <TransactionCreateDropdown onCreate={openCreateForm} />
      {createDrawerOpen && (
        <TransactionCreateDrawer
          bookId={session.bookId}
          open={createDrawerOpen}
          transactionType={creatingTransactionType}
          onOpenChange={setCreateDrawerOpen}
        />
      )}
    </>
  )
}
