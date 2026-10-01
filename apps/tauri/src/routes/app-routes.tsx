import { Route, Routes, useNavigate, useParams } from "react-router"
import CategoriesPage from "../features/categories/components/categories-page"
import { ApplicationShell } from "../layout/app-shell"
import { CreateBookPage } from "../features/books/components/create-book-page"
import { HandleBootstrap } from "../bootstrap/handle-bootstrap"
import { SelectBookPage } from "../features/books/components/select-books-page"
import { AccountsPage } from "../features/accounts/components/accounts-page"
import { TransactionsPage } from "../features/transactions"
import { InvestmentsPage } from "../features/investments/components/investments-page"
import { useActiveBook } from "../providers"
import { ErrorState } from "@workspace/ui/components/error-state"

function InvestmentsRoute() {
  const { positionId } = useParams<{ positionId: string }>()
  const navigate = useNavigate()
  const { session } = useActiveBook()

  if (session.status !== "ACTIVE")
    return (
      <ErrorState
        variant="book-required"
        title="Selecione um livro para ver investimentos"
        description="As carteiras, posições e saldos pertencem ao livro ativo."
        actionLabel="Escolher livro"
        actionHref="/books"
      />
    )

  return (
    <InvestmentsPage
      positionId={positionId}
      onNavigatePosition={(id) =>
        void navigate(
          id === null
            ? "/investments"
            : `/investments/positions/${encodeURIComponent(id)}`,
          { replace: id === null }
        )
      }
    />
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<HandleBootstrap />} />

      <Route element={<ApplicationShell />}>
        <Route path="dashboard" element={<CategoriesPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="investments" element={<InvestmentsRoute />} />
        <Route
          path="investments/positions/:positionId"
          element={<InvestmentsRoute />}
        />
      </Route>

      <Route path="books">
        <Route index element={<SelectBookPage />} />
        <Route path="new" element={<CreateBookPage />} />
      </Route>
    </Routes>
  )
}
