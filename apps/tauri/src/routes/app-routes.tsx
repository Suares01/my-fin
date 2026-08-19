import { Route, Routes } from "react-router"
import CategoriesPage from "../features/categories/components/categories-page"

export default function AppRoutes() {
  return (
    <Routes>
      <Route index element={<CategoriesPage />} />
    </Routes>
  )
}
