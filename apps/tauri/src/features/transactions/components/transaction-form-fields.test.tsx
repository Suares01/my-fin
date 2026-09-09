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
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { Button } from "@workspace/ui/components/button"
import { TransactionFormFields } from "./transaction-form-fields"
import { incomeFormSchema } from "../transaction-form-schema"

type Values = z.input<typeof incomeFormSchema>
function FieldsForm({
  disabled = false,
  onSubmit = vi.fn(),
  values = {},
}: {
  disabled?: boolean
  onSubmit?: (draft: z.output<typeof incomeFormSchema>) => void
  values?: Partial<Values>
}) {
  const form = useForm<Values, unknown, z.output<typeof incomeFormSchema>>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      type: "INCOME",
      accountId: "a1",
      categoryId: "c1",
      currency: "BRL",
      valueCents: 1000,
      occurredOn: "2026-09-03",
      description: "Mercado",
      ...values,
    },
  })
  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <TransactionFormFields
        control={form.control}
        currency={values.currency ?? "BRL"}
        disabled={disabled}
      />
      <Button type="submit">Enviar</Button>
      <Button type="button" onClick={() => form.reset()}>
        Restaurar
      </Button>
    </form>
  )
}

afterEach(cleanup)
describe("TransactionFormFields", () => {
  it("renders amount, local date and description from RHF", () => {
    render(<FieldsForm />)
    expect(
      (screen.getByLabelText("Valor") as HTMLInputElement).value.replace(
        /\s/g,
        " "
      )
    ).toBe("R$ 10,00")
    expect(screen.getByLabelText("Data").textContent).toContain(
      "3 de setembro de 2026"
    )
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe(
      "Mercado"
    )
  })
  it("submits controlled edits as a validated draft and restores defaults", async () => {
    const submit = vi.fn()
    render(<FieldsForm onSubmit={submit} />)
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "12,34" },
    })
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "  Salário  " },
    })
    fireEvent.click(screen.getByLabelText("Data"))
    fireEvent.click(
      screen.getByRole("button", { name: "sexta-feira, 4 de setembro de 2026" })
    )
    fireEvent.click(screen.getByText("Enviar"))
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMinor: "1234",
          occurredOn: "2026-09-04",
          description: "Salário",
        }),
        expect.anything()
      )
    )
    fireEvent.click(screen.getByText("Restaurar"))
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe(
      "Mercado"
    )
  })
  it.each([
    [{ valueCents: 0 }, "Valor", "Informe um valor inteiro positivo."],
    [
      { occurredOn: "2026-02-30" },
      "Data",
      "Informe uma data válida no formato AAAA-MM-DD.",
    ],
    [{ description: " " }, "Descrição", "Informe uma descrição."],
  ] as const)(
    "associates validation and focus with the invalid control: %s",
    async (values, label, message) => {
      render(<FieldsForm values={values} />)
      expect(screen.queryByText(message)).toBeNull()
      fireEvent.click(screen.getByText("Enviar"))
      const error = await screen.findByText(message)
      const input = screen.getByLabelText(label)
      expect(input.getAttribute("aria-invalid")).toBe("true")
      expect(input.getAttribute("aria-describedby")).toContain(error.id)
      await waitFor(() => expect(document.activeElement).toBe(input))
    }
  )
  it("uses unique IDs for multiple instances", () => {
    render(
      <>
        <FieldsForm />
        <FieldsForm />
      </>
    )
    const inputs = screen.getAllByLabelText("Descrição")
    expect(inputs[0].id).not.toBe(inputs[1].id)
  })
  it("disables every control without losing the draft", () => {
    const { rerender } = render(<FieldsForm disabled />)
    for (const label of ["Valor", "Data", "Descrição"])
      expect(screen.getByLabelText(label).hasAttribute("disabled")).toBe(true)
    rerender(<FieldsForm />)
    expect((screen.getByLabelText("Descrição") as HTMLInputElement).value).toBe(
      "Mercado"
    )
  })
})
