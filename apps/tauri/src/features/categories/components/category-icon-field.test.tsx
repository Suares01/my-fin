/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useForm } from "react-hook-form"
import {
  categoryIconNames,
  getCategoryIconEntries,
} from "../../../components/category-icons"
import { CategoryIconField } from "./category-icon-field"

type FormValues = {
  iconKey: string
}

function IconForm({
  disabled = false,
  onSubmit = vi.fn(),
}: {
  disabled?: boolean
  onSubmit?: (values: FormValues) => void
}) {
  const form = useForm<FormValues>({
    defaultValues: { iconKey: "label-dollar" },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <CategoryIconField
        control={form.control}
        name="iconKey"
        label="Ícone da categoria"
        description="Escolha um ícone."
        disabled={disabled}
      />
      <button type="submit">Enviar</button>
      <button
        type="button"
        onClick={() =>
          form.setError("iconKey", { message: "Escolha um ícone." })
        }
      >
        Mostrar erro
      </button>
    </form>
  )
}

afterEach(cleanup)

describe("CategoryIconField", () => {
  it("renders every registry icon exactly once with an accessible name", () => {
    render(<IconForm />)

    const radios = screen.getAllByRole("radio")

    expect(radios).toHaveLength(categoryIconNames.length)
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual(
      categoryIconNames.map((name) => `Ícone ${name}`)
    )
    expect(
      radios.filter((radio) => (radio as HTMLInputElement).checked)
    ).toHaveLength(1)
    expect(getCategoryIconEntries()).toHaveLength(radios.length)
  })

  it("registers a selected icon value in React Hook Form", async () => {
    const onSubmit = vi.fn()
    render(<IconForm onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("radio", { name: "Ícone home" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { iconKey: "home" },
        expect.anything()
      )
    )
  })

  it("moves one selection with the arrow keys", () => {
    render(<IconForm />)
    const current = screen.getByRole("radio", { name: "Ícone label-dollar" })
    const next = screen.getByRole("radio", { name: "Ícone map-marker" })

    fireEvent.keyDown(current, { key: "ArrowRight" })

    expect((current as HTMLInputElement).checked).toBe(false)
    expect((next as HTMLInputElement).checked).toBe(true)
  })

  it("shows a field error through the controlled field", () => {
    render(<IconForm />)

    fireEvent.click(screen.getByRole("button", { name: "Mostrar erro" }))

    expect(screen.getByRole("alert").textContent).toContain("Escolha um ícone.")
  })

  it("disables every radio and preserves the selected value", () => {
    render(<IconForm disabled />)
    const current = screen.getByRole("radio", { name: "Ícone label-dollar" })

    expect(
      screen
        .getAllByRole("radio")
        .every((radio) => (radio as HTMLInputElement).disabled)
    ).toBe(true)
    fireEvent.click(current)
    expect((current as HTMLInputElement).checked).toBe(true)
  })
})
