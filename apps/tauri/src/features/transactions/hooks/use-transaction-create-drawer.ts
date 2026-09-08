import { useCallback, useState } from "react"

export type TransactionCreateType = "INCOME" | "EXPENSE" | "TRANSFER"

export function useTransactionCreateDrawer() {
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [creatingTransactionType, setCreatingTransactionType] = useState<
    TransactionCreateType | undefined
  >()

  const openCreateForm = useCallback((type: TransactionCreateType) => {
    setCreatingTransactionType(type)
    setCreateDrawerOpen(true)
  }, [])

  const closeCreateForm = useCallback(() => {
    setCreateDrawerOpen(false)
    setCreatingTransactionType(undefined)
  }, [])

  const handleCreateDrawerOpenChange = useCallback((open: boolean) => {
    setCreateDrawerOpen(open)
    if (!open) setCreatingTransactionType(undefined)
  }, [])

  return {
    createDrawerOpen,
    creatingTransactionType,
    openCreateForm,
    closeCreateForm,
    setCreateDrawerOpen: handleCreateDrawerOpenChange,
  }
}
