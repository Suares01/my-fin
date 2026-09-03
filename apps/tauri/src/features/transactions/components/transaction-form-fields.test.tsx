/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TransactionFormFields } from "./transaction-form-fields.js"

function renderFields(overrides: Partial<React.ComponentProps<typeof TransactionFormFields>> = {}) {
  const props = { amount: "10,00", currency: "BRL", occurredOn: "2026-09-03", description: "Mercado", onAmountChange: vi.fn(), onOccurredOnChange: vi.fn(), onDescriptionChange: vi.fn(), ...overrides }
  return { props, ...render(<TransactionFormFields {...props} />) }
}

describe("TransactionFormFields", () => {
  afterEach(cleanup)
  it("renders controlled amount, civil date and description values", () => { renderFields(); expect(screen.getByLabelText("Valor").getAttribute("value")).toBe("10,00"); expect(screen.getByLabelText("Data").getAttribute("value")).toBe("2026-09-03"); expect(screen.getByLabelText("Descrição").getAttribute("value")).toBe("Mercado") })
  it("reports money values through the money boundary", () => { const { props } = renderFields(); fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "12,34" } }); expect(props.onAmountChange).toHaveBeenCalledWith({ display: "12,34", amountMinor: "1234" }) })
  it("reports a keyboard-operable native civil date", () => { const { props } = renderFields(); fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-04" } }); expect(props.onOccurredOnChange).toHaveBeenCalledWith("2026-09-04") })
  it("reports description changes", () => { const { props } = renderFields(); fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Salário" } }); expect(props.onDescriptionChange).toHaveBeenCalledWith("Salário") })
  it("shows the amount error beside its field", () => { renderFields({ errors: { amountMinor: "Informe um valor inteiro positivo." } }); expect(screen.getByText("Informe um valor inteiro positivo.")).toBeTruthy() })
  it("shows the date error beside its field", () => { renderFields({ errors: { occurredOn: "Informe uma data válida no formato AAAA-MM-DD." } }); expect(screen.getByText("Informe uma data válida no formato AAAA-MM-DD.")).toBeTruthy() })
  it("shows the description error beside its field", () => { renderFields({ errors: { description: "Informe uma descrição." } }); expect(screen.getByText("Informe uma descrição.")).toBeTruthy() })
  it("disables every control while pending", () => { renderFields({ disabled: true }); expect(screen.getByLabelText("Valor").hasAttribute("disabled")).toBe(true); expect(screen.getByLabelText("Data").hasAttribute("disabled")).toBe(true); expect(screen.getByLabelText("Descrição").hasAttribute("disabled")).toBe(true) })
})
