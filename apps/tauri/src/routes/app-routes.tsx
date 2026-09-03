import { Route, Routes } from "react-router"
import CategoriesPage from "../features/categories/components/categories-page"
import { ApplicationShell } from "../layout/app-shell"
import { CreateBookPage } from "../features/books/components/create-book-page"
import { HandleBootstrap } from "../bootstrap/handle-bootstrap"
import { SelectBookPage } from "../features/books/components/select-books-page"
import { AccountsPage } from "../features/accounts/components/accounts-page"

export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<HandleBootstrap />} />

      <Route element={<ApplicationShell />}>
        <Route path="dashboard" element={<CategoriesPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
      </Route>

      <Route path="books">
        <Route index element={<SelectBookPage />} />
        <Route path="new" element={<CreateBookPage />} />
      </Route>
    </Routes>
  )
}
