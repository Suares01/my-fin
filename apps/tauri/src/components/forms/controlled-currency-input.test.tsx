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
import { ControlledCurrencyInput } from "./controlled-currency-input"

function CurrencyForm({
  value = 0,
  currency = "BRL",
  onSubmit = vi.fn(),
}: {
  value?: number
  currency?: string
  onSubmit?: (values: { cents: number }) => void
}) {
  const form = useForm({ defaultValues: { cents: value } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <ControlledCurrencyInput
        control={form.control}
        name="cents"
        label="Valor"
        currency={currency}
      />
      <button type="submit">Enviar</button>
    </form>
  )
}

afterEach(cleanup)
describe("ControlledCurrencyInput", () => {
  it.each([
    ["1", 1, "R$ 0,01"],
    ["R$ 1.234,56", 123456, "R$ 1.234,56"],
    ["", 0, "R$ 0,00"],
  ] as const)("edits cents from %s", async (text, cents, display) => {
    const submit = vi.fn()
    render(<CurrencyForm value={1000} onSubmit={submit} />)
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: text },
    })
    expect(
      (screen.getByLabelText("Valor") as HTMLInputElement).value.replace(
        /\s/g,
        " "
      )
    ).toBe(display)
    fireEvent.click(screen.getByText("Enviar"))
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({ cents }, expect.anything())
    )
  })
  it("keeps the maximum integer exact when displaying, editing and submitting", async () => {
    const submit = vi.fn()
    render(<CurrencyForm value={Number.MAX_SAFE_INTEGER} onSubmit={submit} />)
    const input = screen.getByLabelText("Valor") as HTMLInputElement
    expect(input.value.replace(/\s/g, " ")).toBe("R$ 90.071.992.547.409,91")
    fireEvent.change(input, { target: { value: "90.071.992.547.409,92" } })
    expect(input.value.replace(/\s/g, " ")).toBe("R$ 90.071.992.547.409,91")
    fireEvent.click(screen.getByText("Enviar"))
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        { cents: Number.MAX_SAFE_INTEGER },
        expect.anything()
      )
    )
  })
  it("rejects an oversized pasted input without replacing the previous amount", () => {
    render(<CurrencyForm value={1234} />)
    const input = screen.getByLabelText("Valor") as HTMLInputElement
    fireEvent.change(input, {
      target: { value: "99999999999999999999999999999" },
    })
    expect(input.value.replace(/\s/g, " ")).toBe("R$ 12,34")
  })
  it("uses the requested book currency", () => {
    render(<CurrencyForm currency="USD" value={1000} />)
    expect(
      (screen.getByLabelText("Valor") as HTMLInputElement).value.replace(
        /\s/g,
        " "
      )
    ).toBe("US$ 10,00")
  })
})
