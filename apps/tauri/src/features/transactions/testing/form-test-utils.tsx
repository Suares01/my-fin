import type { ReactElement } from "react"
import { render, fireEvent, screen } from "@testing-library/react"
import { Toaster } from "@workspace/ui/components/toast"

export function renderTransactionForm(ui: ReactElement) {
  return render(ui, { wrapper: Toaster })
}

export function selectOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }))
  const item = screen.getByRole("option", { name: option })
  fireEvent.pointerDown(item)
  fireEvent.click(item)
}
