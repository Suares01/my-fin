/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import { ControlledToggleGroup } from "./controlled-toggle-group"

type FormValues = {
  readonly kind: string
}

function ToggleGroupForm({
  defaultKind = "EXPENSE",
  disabled = false,
  onSubmit = vi.fn(),
}: {
  readonly defaultKind?: string
  readonly disabled?: boolean
  readonly onSubmit?: (values: FormValues) => void
}) {
  const form = useForm<FormValues>({ defaultValues: { kind: defaultKind } })
  const { touchedFields } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <ControlledToggleGroup
        control={form.control}
        name="kind"
        label="Tipo"
        description="Escolha uma opção."
        disabled={disabled}
        options={[
          { value: "EXPENSE", label: "Despesa" },
          { value: "INCOME", label: "Receita" },
        ]}
      />
      <button
        type="button"
        onClick={() => form.setError("kind", { message: "Escolha um tipo." })}
      >
        Mostrar erro
      </button>
      <button type="submit">Enviar</button>
      <output>{touchedFields.kind ? "Tocado" : "Não tocado"}</output>
    </form>
  )
}

describe("ControlledToggleGroup", () => {
  afterEach(cleanup)

  it("renders the initial value with its accessible field metadata", () => {
    render(<ToggleGroupForm />)

    expect(screen.getByRole("group", { name: "Tipo" })).toBeTruthy()
    expect(screen.getByText("Escolha uma opção.")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Despesa" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Receita" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("submits a changed selection and the empty value after clearing it", async () => {
    const onSubmit = vi.fn()
    render(<ToggleGroupForm onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: "Receita" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { kind: "INCOME" },
        expect.anything()
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Receita" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith({ kind: "" }, expect.anything())
    )
  })

  it("forwards blur to React Hook Form", async () => {
    render(<ToggleGroupForm />)

    fireEvent.blur(screen.getByRole("group", { name: "Tipo" }))

    expect(await screen.findByText("Tocado")).toBeTruthy()
  })

  it("shows the React Hook Form error and disables every option", () => {
    render(<ToggleGroupForm disabled />)

    fireEvent.click(screen.getByRole("button", { name: "Mostrar erro" }))

    expect(screen.getByRole("alert").textContent).toContain("Escolha um tipo.")
    expect(
      screen
        .getByRole("button", { name: "Despesa" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Receita" })
        .getAttribute("aria-disabled")
    ).toBe("true")
  })
})
