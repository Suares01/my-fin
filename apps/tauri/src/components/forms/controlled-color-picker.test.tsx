/* @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useForm } from "react-hook-form"
import { ControlledColorPicker } from "./controlled-color-picker"

type FormValues = {
  colorHex: string
}

function ColorForm({
  defaultValue = "112233",
  disabled = false,
  onSubmit = vi.fn(),
}: {
  defaultValue?: string
  disabled?: boolean
  onSubmit?: (values: FormValues) => void
}) {
  const form = useForm<FormValues>({
    defaultValues: { colorHex: defaultValue },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <ControlledColorPicker
        control={form.control}
        name="colorHex"
        label="Cor da categoria"
        description="Escolha uma cor opaca."
        disabled={disabled}
      />
      <button type="submit">Enviar</button>
      <button type="button" onClick={() => form.reset({ colorHex: "445566" })}>
        Resetar
      </button>
      <button
        type="button"
        onClick={() => form.setError("colorHex", { message: "Cor inválida." })}
      >
        Mostrar erro
      </button>
    </form>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

describe("ControlledColorPicker", () => {
  it("delegates label, description and errors through the controlled field", () => {
    render(<ColorForm />)

    expect(screen.getByLabelText("Cor da categoria")).toBeTruthy()
    expect(screen.getByText("Escolha uma cor opaca.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Mostrar erro" }))
    expect(screen.getByRole("alert").textContent).toContain("Cor inválida.")
  })

  it("renders an opaque picker without alpha, percentage or format controls", () => {
    render(<ColorForm />)

    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.queryByText("%")).toBeNull()
    expect(screen.queryByRole("slider", { name: /alpha/i })).toBeNull()
    expect(screen.getByRole("slider")).toBeTruthy()
  })

  it("submits the controlled hexadecimal value unchanged", async () => {
    const onSubmit = vi.fn()
    render(<ColorForm onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { colorHex: "112233" },
        expect.anything()
      )
    )
  })

  it("keeps an invalid manual value visible for schema validation", () => {
    render(<ColorForm />)
    const input = screen.getByLabelText("Cor da categoria") as HTMLInputElement

    fireEvent.change(input, { target: { value: "#abc" } })

    expect(input.value).toBe("#abc")
  })

  it("normalizes eyedropper RGB output and discards alpha", async () => {
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = async () => ({ sRGBHex: "#ABCDEF" })
      }
    )
    const onSubmit = vi.fn()
    render(<ColorForm onSubmit={onSubmit} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Escolher cor com conta-gotas" })
    )
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Cor da categoria") as HTMLInputElement).value
      ).toBe("abcdef")
    )
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { colorHex: "abcdef" },
        expect.anything()
      )
    )
  })

  it("syncs reset values without emitting a divergent value", async () => {
    const onSubmit = vi.fn()
    render(<ColorForm onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: "Resetar" }))
    expect(
      (screen.getByLabelText("Cor da categoria") as HTMLInputElement).value
    ).toBe("445566")
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { colorHex: "445566" },
        expect.anything()
      )
    )
  })

  it("disables the text input, hue slider and eyedropper together", () => {
    render(<ColorForm disabled />)

    const input = screen.getByLabelText("Cor da categoria") as HTMLInputElement

    expect(input).toHaveProperty("disabled", true)
    expect(screen.getByRole("slider").hasAttribute("data-disabled")).toBe(true)
    expect(
      screen.getByRole("button", { name: "Escolher cor com conta-gotas" })
    ).toHaveProperty("disabled", true)
    fireEvent.change(input, { target: { value: "abcdef" } })
    expect(input.value).toBe("112233")
  })
})
